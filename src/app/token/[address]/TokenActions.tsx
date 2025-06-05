"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Token } from "@/src/app/types/token";
import { StakeButton } from "@/src/components/StakeButton";
import { publicClient } from "@/src/lib/viemClient";
import { UnstakeButton } from "@/src/components/UnstakeButton";
import { ConnectPoolButton } from "@/src/components/ConnectPoolButton";
import { ZapStakeButton } from "@/src/components/ZapStakeButton";
import { SwapButton } from "@/src/components/SwapButton";
import { Wallet } from "lucide-react";
import {
  LP_FACTORY_ADDRESS,
  LP_FACTORY_ABI,
  GDA_FORWARDER,
  GDA_ABI,
} from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { Button as UiButton } from "@/src/components/ui/button";
import { useWalletAddressChange } from "@/src/hooks/useWalletSync";
import { parseEther } from "viem";

interface TokenActionsProps {
  token: Token;
  onStakingChange: () => void;
  isMiniAppView?: boolean;
  address?: `0x${string}` | undefined;
  isConnected?: boolean;
}

type Deployment = {
  token: string;
  locker: string;
  positionId: bigint;
};

export function TokenActions({
  token: initialToken,
  onStakingChange,
  isMiniAppView: isMiniAppViewProp,
  address: addressProp,
  isConnected: isConnectedProp,
}: TokenActionsProps) {
  const [token, setToken] = useState(initialToken);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isConnectedToPool, setIsConnectedToPool] = useState(false);
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);
  const [ethBalance, setEthBalance] = useState<bigint>(0n);

  // Trading interface state
  const [tradeDirection, setTradeDirection] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState(""); // Start empty, will be set by useEffect
  const [priceQuote, setPriceQuote] = useState<{
    buyAmount: string;
    sellAmount: string;
    liquidityAvailable: boolean;
  } | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Create stable references for contract addresses to prevent unnecessary re-renders
  const stakingPoolAddress = useMemo(() => {
    console.log(
      "stakingPoolAddress memoized value changed:",
      initialToken.staking_pool
    );
    return initialToken.staking_pool;
  }, [initialToken.staking_pool]);

  const contractAddress = useMemo(() => {
    console.log(
      "contractAddress memoized value changed:",
      initialToken.contract_address
    );
    return initialToken.contract_address;
  }, [initialToken.contract_address]);

  const stakingAddress = useMemo(() => {
    console.log(
      "stakingAddress memoized value changed:",
      initialToken.staking_address
    );
    return initialToken.staking_address;
  }, [initialToken.staking_address]);

  const {
    isSDKLoaded: fcSDKLoaded,
    isMiniAppView: detectedMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
    connect: fcConnect,
    connectors: fcConnectors,
    // farcasterContext,
  } = useAppFrameLogic();

  const { user: privyUser, ready: privyReady, login: privyLogin } = usePrivy();
  const { wallets } = useWallets();
  const { refreshTrigger, primaryAddress } = useWalletAddressChange();

  // Simplified mini app detection - use the improved detection from useAppFrameLogic
  const isEffectivelyMiniApp = isMiniAppViewProp ?? detectedMiniAppView;

  let currentAddress: `0x${string}` | undefined;
  let walletIsConnected: boolean;
  let effectiveLogin: () => void;

  if (isEffectivelyMiniApp) {
    currentAddress = addressProp ?? fcAddress;
    walletIsConnected = isConnectedProp ?? fcIsConnected;
    effectiveLogin = () => {
      if (fcConnect && fcConnectors && fcConnectors.length > 0) {
        fcConnect({ connector: fcConnectors[0] });
      } else {
        console.warn("Farcaster connect function not available");
      }
    };
  } else {
    // For non-mini apps, use primaryAddress from useWalletAddressChange hook for better wallet switching support
    currentAddress = (primaryAddress || privyUser?.wallet?.address) as
      | `0x${string}`
      | undefined;
    // Check if Privy is ready, user has a wallet, and wallets array is populated
    const hasPrivyWallet = privyReady && !!privyUser?.wallet?.address;
    const walletsReady = wallets && wallets.length > 0;
    const exactWalletMatch =
      walletsReady &&
      wallets.some((w) => w.address === privyUser?.wallet?.address);
    const caseInsensitiveMatch =
      walletsReady &&
      wallets.some(
        (w) =>
          w.address?.toLowerCase() === privyUser?.wallet?.address?.toLowerCase()
      );
    const singleWalletFallback =
      walletsReady && wallets.length === 1 && hasPrivyWallet;

    walletIsConnected =
      hasPrivyWallet &&
      walletsReady &&
      (exactWalletMatch || caseInsensitiveMatch || singleWalletFallback);
    effectiveLogin = privyLogin;
  }

  // Enhanced 0x Gasless API integration
  const getGaslessQuote = useCallback(
    async (amount: string, direction: "buy" | "sell") => {
      if (!currentAddress || !amount || parseFloat(amount) <= 0) return null;

      setIsPriceLoading(true);
      try {
        let sellToken: string;
        let buyToken: string;
        let apiEndpoint: string;

        if (direction === "buy") {
          // Use regular API for ETH swaps (buying tokens with ETH)
          const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
          sellToken = ETH_ADDRESS;
          buyToken = contractAddress;
          apiEndpoint = "/api/price";
        } else {
          // Use gasless API for token swaps (selling tokens for ETH)
          const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
          sellToken = contractAddress;
          buyToken = WETH_ADDRESS;
          apiEndpoint = "/api/gasless/price";
        }

        const sellAmount = parseEther(amount).toString();

        const params = new URLSearchParams({
          chainId: "8453",
          sellToken,
          buyToken,
          sellAmount,
          taker: currentAddress,
        });

        const response = await fetch(`${apiEndpoint}?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to get quote");

        const data = await response.json();
        if (data.liquidityAvailable === false) {
          throw new Error("No liquidity available for this token pair");
        }

        return data;
      } catch (error) {
        console.error("Quote error:", error);
        return null;
      } finally {
        setIsPriceLoading(false);
      }
    },
    [currentAddress, contractAddress]
  );

  // Debounced quote fetching
  useEffect(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      setPriceQuote(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      getGaslessQuote(tradeAmount, tradeDirection).then(setPriceQuote);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [tradeAmount, tradeDirection, getGaslessQuote]);

  useEffect(() => {
    const addressToFetch = initialToken.contract_address;
    const fetchTokenData = async () => {
      try {
        // console.log("Fetching token data for:", addressToFetch);
        const response = await fetch(
          `/api/tokens/single?address=${addressToFetch}`
        );
        if (!response.ok) {
          console.error(
            `TokenActions: Error fetching token data: ${response.status} for address ${addressToFetch}`
          );
          return;
        }
        const result = await response.json();
        if (result.data) {
          if (
            result.data.contract_address &&
            result.data.contract_address.toLowerCase() ===
              addressToFetch.toLowerCase()
          ) {
            // Only update if the data actually changed
            const newToken = result.data;
            setToken((currentToken) => {
              const hasChanged =
                newToken.staking_pool !== currentToken.staking_pool ||
                newToken.staking_address !== currentToken.staking_address ||
                newToken.contract_address !== currentToken.contract_address;

              if (hasChanged) {
                console.log("Token data changed, updating:", {
                  old: {
                    staking_pool: currentToken.staking_pool,
                    staking_address: currentToken.staking_address,
                    contract_address: currentToken.contract_address,
                  },
                  new: {
                    staking_pool: newToken.staking_pool,
                    staking_address: newToken.staking_address,
                    contract_address: newToken.contract_address,
                  },
                });
                return newToken;
              } else {
                console.log("Token data unchanged, skipping update");
                return currentToken;
              }
            });
          } else {
            console.warn(
              "TokenActions: Fetched token data for a different address than requested.",
              {
                requested: addressToFetch,
                received: result.data.contract_address,
              }
            );
          }
        }
      } catch (error) {
        console.error(
          `TokenActions: Error fetching token ${addressToFetch}:`,
          error
        );
      }
    };

    const intervalId = setInterval(fetchTokenData, 10000);
    fetchTokenData();

    return () => clearInterval(intervalId);
  }, [initialToken.contract_address]);

  useEffect(() => {
    if (!currentAddress || !walletIsConnected) {
      console.log(
        "Skipping creator check - no address connected or user object not ready"
      );
      return;
    }
    const checkIsCreator = async () => {
      console.log("Checking if address is creator:", {
        userAddress: currentAddress,
        tokenAddress: contractAddress,
      });
      try {
        const deployments = (await publicClient.readContract({
          address: LP_FACTORY_ADDRESS,
          abi: LP_FACTORY_ABI,
          functionName: "getTokensDeployedByUser",
          args: [currentAddress as `0x${string}`],
        })) as Deployment[];
        const isCreatorResult = deployments.some(
          (d) => d.token.toLowerCase() === contractAddress.toLowerCase()
        );
        if (isCreatorResult) {
          console.log("User is creator of this token");
        }
      } catch (error) {
        console.error("Error checking creator status:", error);
      }
    };
    checkIsCreator();
  }, [currentAddress, walletIsConnected, contractAddress]);

  useEffect(() => {
    console.log("Pool connection useEffect triggered by:", {
      currentAddress,
      walletIsConnected,
      stakingPoolAddress,
    });

    const checkPoolConnection = async () => {
      if (!currentAddress || !walletIsConnected) {
        console.log(
          "TokenActions: Pool Connection Check: Skipping, no currentAddress or wallet not connected.",
          { currentAddressPresent: !!currentAddress, walletIsConnected }
        );
        setIsConnectedToPool(false);
        return;
      }
      if (!stakingPoolAddress) {
        console.log(
          `TokenActions: Pool Connection Check: Skipping, no staking_pool defined for token ${contractAddress}`
        );
        setIsConnectedToPool(false);
        return;
      }

      try {
        console.log(
          `TokenActions: Pool Connection Check: Reading GDA_FORWARDER.isMemberConnected for pool ${stakingPoolAddress}, member ${currentAddress}`
        );
        const connectedStatus = await publicClient.readContract({
          address: GDA_FORWARDER,
          abi: GDA_ABI,
          functionName: "isMemberConnected",
          args: [
            stakingPoolAddress as `0x${string}`,
            currentAddress as `0x${string}`,
          ],
        });
        console.log(
          `TokenActions: Pool Connection Check: Status for pool ${stakingPoolAddress}, member ${currentAddress} is ${connectedStatus}`
        );
        setIsConnectedToPool(connectedStatus);
      } catch (error) {
        console.error(
          `TokenActions: Pool Connection Check: Error for pool ${stakingPoolAddress}, member ${currentAddress}`,
          error
        );
        setIsConnectedToPool(false);
      }
    };
    checkPoolConnection();
  }, [currentAddress, walletIsConnected, stakingPoolAddress]);

  useEffect(() => {
    const checkStakedBalance = async () => {
      if (!currentAddress || !walletIsConnected || !stakingAddress) return;
      try {
        const stakedVal = await publicClient.readContract({
          address: stakingAddress as `0x${string}`,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [currentAddress as `0x${string}`],
        });
        setStakedBalance(stakedVal as bigint);
      } catch (error) {
        console.error("Error checking staked balance:", error);
      }
    };
    checkStakedBalance();
  }, [currentAddress, walletIsConnected, stakingAddress, refreshTrigger]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!currentAddress || !walletIsConnected) return;
      try {
        const balVal = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [currentAddress as `0x${string}`],
        });
        setBalance(balVal as bigint);

        // Also fetch ETH balance
        const ethBal = await publicClient.getBalance({
          address: currentAddress as `0x${string}`,
        });
        setEthBalance(ethBal);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };
    fetchBalance();
  }, [currentAddress, walletIsConnected, contractAddress, refreshTrigger]);

  const hasTokens = walletIsConnected && balance > 0n;

  const refreshBalances = useCallback(async () => {
    if (!currentAddress || !walletIsConnected) return;
    try {
      const balVal = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [currentAddress as `0x${string}`],
      });
      setBalance(balVal as bigint);

      // Also refresh ETH balance
      const ethBal = await publicClient.getBalance({
        address: currentAddress as `0x${string}`,
      });
      setEthBalance(ethBal);

      if (stakingAddress) {
        const stakedVal = await publicClient.readContract({
          address: stakingAddress as `0x${string}`,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [currentAddress as `0x${string}`],
        });
        setStakedBalance(stakedVal as bigint);
      }
      onStakingChange();
    } catch (error) {
      console.error("Error refreshing balances:", error);
    }
  }, [
    currentAddress,
    walletIsConnected,
    contractAddress,
    stakingAddress,
    onStakingChange,
    refreshTrigger,
  ]);

  // Helper function to calculate amount based on percentage
  const calculatePercentageAmount = useCallback(
    (percentage: number) => {
      if (tradeDirection === "buy") {
        // For buying, use percentage of ETH balance
        const ethAmount = Number(ethBalance) / 1e18;
        return ((ethAmount * percentage) / 100).toFixed(6);
      } else {
        // For selling, use percentage of token balance
        const tokenAmount = Number(balance) / 1e18;
        let calculatedAmount = (tokenAmount * percentage) / 100;

        // For 100% selling, apply a small safety buffer to prevent insufficient balance errors
        if (percentage === 100) {
          calculatedAmount = calculatedAmount * 0.999; // Use 99.9% to account for small discrepancies
        }

        return calculatedAmount.toFixed(6);
      }
    },
    [tradeDirection, ethBalance, balance]
  );

  // Handle percentage button clicks
  const handlePercentageClick = useCallback(
    (percentage: number) => {
      const amount = calculatePercentageAmount(percentage);
      setTradeAmount(amount);
    },
    [calculatePercentageAmount]
  );

  // Handle fixed ETH amount clicks for buying
  const handleFixedAmountClick = useCallback((amount: number) => {
    setTradeAmount(amount.toString());
  }, []);

  // Reset to default amount when switching trade direction
  useEffect(() => {
    if (tradeDirection === "buy") {
      setTradeAmount("0.001"); // Default to 0.001 ETH for buying
    } else {
      setTradeAmount(""); // Clear amount for selling
    }
  }, [tradeDirection]);

  // Initialize trade amount on component mount
  useEffect(() => {
    if (tradeDirection === "buy") {
      setTradeAmount("0.001");
    }
  }, []); // Only run on mount

  if (isEffectivelyMiniApp && !fcSDKLoaded) {
    return (
      <div className="card bg-base-100 border border-black/[.1]1]">
        <div className="card-body items-center justify-center min-h-[100px]">
          <span className="loading loading-spinner loading-sm"></span>
          <p className="text-sm text-gray-500">Loading Farcaster SDK...</p>
        </div>
      </div>
    );
  }

  if (!isEffectivelyMiniApp && !privyReady) {
    return (
      <div className="card bg-base-100 border border-black/[.1]1]">
        <div className="card-body items-center justify-center min-h-[100px]">
          <span className="loading loading-spinner loading-sm"></span>
          <p className="text-sm text-gray-500">Initializing wallet...</p>
        </div>
      </div>
    );
  }

  if (!walletIsConnected) {
    return (
      <div className="card bg-base-100 border border-black/[.1]1]">
        <div className="card-body items-center">
          <div className="mb-4 text-center">
            <Wallet size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="font-semibold">
              {isEffectivelyMiniApp ? "Farcaster Wallet" : "Wallet"} Not
              Connected
            </p>
          </div>
          <div>
            <UiButton
              onClick={effectiveLogin}
              className="btn btn-primary btn-sm w-full"
            >
              {isEffectivelyMiniApp
                ? "Connect Farcaster Wallet"
                : "Connect Wallet"}
            </UiButton>
          </div>
        </div>
      </div>
    );
  }

  const showConnectPoolButton =
    hasTokens &&
    stakingPoolAddress &&
    stakedBalance === 0n &&
    !isConnectedToPool;

  // Debug logging for ConnectPoolButton visibility
  console.log("ConnectPoolButton visibility check:", {
    hasTokens,
    stakingPoolAddress: !!stakingPoolAddress,
    stakedBalance: stakedBalance.toString(),
    stakedBalanceIsZero: stakedBalance === 0n,
    isConnectedToPool,
    showConnectPoolButton,
    walletIsConnected,
    balance: balance.toString(),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 space-y-4">
        {/* Trading Interface */}
        {!isEffectivelyMiniApp && (
          <div className="space-y-4">
            {/* Buy/Sell Toggle */}
            <div className="bg-gray-50 rounded-lg p-1 flex">
              <button
                onClick={() => setTradeDirection("buy")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  tradeDirection === "buy"
                    ? "bg-accent text-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeDirection("sell")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  tradeDirection === "sell"
                    ? "bg-error text-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                }`}
              >
                Sell
              </button>
            </div>

            {/* Available to Trade */}
            <div className="flex justify-between">
              <div className="text-sm text-gray-400">Balance</div>
              <div className="text-sm text-gray-400">
                {tradeDirection === "buy"
                  ? `${(Number(ethBalance) / 1e18).toFixed(2)} ETH`
                  : `${(Number(balance) / 1e18).toFixed(2)} ${token.symbol}`}
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              {/* <label className="text-sm font-medium text-gray-700">Size</label> */}
              <div className="relative">
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder={tradeDirection === "buy" ? "0.001" : ""}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  step="0.001"
                  min="0"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {tradeDirection === "buy" ? "ETH" : token.symbol}
                </div>
              </div>

              {/* Percentage Buttons */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                {tradeDirection === "buy"
                  ? // Fixed ETH amounts for buying
                    [0.001, 0.01, 0.1, 1].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleFixedAmountClick(amount)}
                        className="py-1 px-2 text-xs rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-500 cursor-pointer"
                      >
                        {amount} eth
                      </button>
                    ))
                  : // Percentage buttons for selling
                    [25, 50, 75, 100].map((percentage) => (
                      <button
                        key={percentage}
                        onClick={() => handlePercentageClick(percentage)}
                        className="py-1 px-2 text-xs font-medium rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-500 cursor-pointer"
                      >
                        {percentage}%
                      </button>
                    ))}
              </div>
            </div>

            {/* Quote Display */}
            {isPriceLoading ? (
              <div className="text-center text-gray-500">
                <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto"></div>
                {/* <div className="text-sm mt-1">Getting quote...</div> */}
              </div>
            ) : priceQuote && tradeAmount ? (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span>Receive:</span>
                  <span className="font-semibold">
                    {(() => {
                      const amount = Number(priceQuote.buyAmount) / 1e18;
                      if (tradeDirection === "sell") {
                        // For selling (receiving ETH), show more decimals if amount is small
                        if (amount < 0.001) {
                          return amount.toFixed(8);
                        } else if (amount < 0.01) {
                          return amount.toFixed(6);
                        } else if (amount < 0.1) {
                          return amount.toFixed(5);
                        } else {
                          return amount.toFixed(4);
                        }
                      } else {
                        // For buying (receiving tokens), use standard 3 decimals
                        return amount.toFixed(3);
                      }
                    })()}{" "}
                    {tradeDirection === "buy" ? token.symbol : "ETH"}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="space-y-2">
              {/* Swap Button */}
              <SwapButton
                tokenAddress={contractAddress as `0x${string}`}
                direction={tradeDirection}
                amount={tradeAmount}
                quote={priceQuote}
                symbol={token.symbol}
                onSuccess={() => {
                  refreshBalances();
                  // Reset to appropriate default based on trade direction
                  setTradeAmount(tradeDirection === "buy" ? "0.001" : "");
                }}
                isMiniApp={isEffectivelyMiniApp}
                farcasterAddress={currentAddress}
                farcasterIsConnected={walletIsConnected}
                className={`w-full btn ${
                  tradeDirection === "buy"
                    ? "border-accent bg-accent/20 text-accent-content hover:bg-accent/30 disabled:!opacity-40 disabled:!border-accent disabled:!bg-accent/5 disabled:!text-accent-content disabled:cursor-not-allowed"
                    : "border-error bg-error/10 text-error-content hover:bg-error/20 disabled:!opacity-40 disabled:!border-error disabled:!bg-error/10 disabled:!text-error-content disabled:cursor-not-allowed"
                }`}
              />
            </div>
            {/* Buy & Stake Button (only for buy direction) */}
            {tradeDirection === "buy" && stakingAddress && (
              <ZapStakeButton
                tokenAddress={contractAddress as `0x${string}`}
                stakingAddress={stakingAddress as `0x${string}`}
                symbol={token.symbol}
                onSuccess={() => {
                  refreshBalances();
                  onStakingChange();
                  setTradeAmount("0.001"); // Reset to default ETH amount
                }}
                disabled={!stakingAddress}
                isMiniApp={isEffectivelyMiniApp}
                farcasterAddress={currentAddress}
                farcasterIsConnected={walletIsConnected}
                amount={tradeAmount}
                className="w-full btn btn-outline relative before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f] before:opacity-30 hover:before:opacity-40 border-[#ffa647]/30 hover:border-[#ffa647]/50 shadow-[0_0_5px_rgba(255,166,71,0.3)] hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]"
              />
            )}
          </div>
        )}
        <div className="my-6 h-px bg-gray-100" />
        {/* Staking Actions */}
        {stakingAddress && (
          <StakeButton
            tokenAddress={contractAddress as `0x${string}`}
            stakingAddress={stakingAddress as `0x${string}`}
            stakingPoolAddress={stakingPoolAddress as `0x${string}`}
            onSuccess={() => {
              refreshBalances();
              onStakingChange();
            }}
            disabled={balance === 0n || !stakingAddress}
            symbol={token.symbol}
            className="btn btn-outline border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 w-full disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50"
            isMiniApp={isEffectivelyMiniApp}
            farcasterAddress={currentAddress}
            farcasterIsConnected={walletIsConnected}
          />
        )}

        <UnstakeButton
          stakingAddress={stakingAddress as `0x${string}`}
          userStakedBalance={stakedBalance}
          onSuccess={() => {
            refreshBalances();
            onStakingChange();
          }}
          disabled={stakedBalance === 0n || !stakingAddress}
          symbol={token.symbol}
          className="btn btn-outline border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 w-full disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50"
          isMiniApp={isEffectivelyMiniApp}
          farcasterAddress={currentAddress}
          farcasterIsConnected={walletIsConnected}
        />

        {/* Pool Connection Status Indicator */}
        {stakingPoolAddress && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 justify-center">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnectedToPool ? "bg-green-500" : "bg-amber-500"
                }`}
              ></div>
              <span className="text-sm font-medium text-gray-700">
                {isConnectedToPool
                  ? "Connected to reward pool"
                  : "Not connected to reward pool"}
              </span>
            </div>
            {!isConnectedToPool && stakedBalance > 0n && (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  Connect to start receiving rewards on your staked tokens
                </p>
                <ConnectPoolButton
                  stakingPoolAddress={stakingPoolAddress as `0x${string}`}
                  onSuccess={() => {
                    setIsConnectedToPool(true);
                    refreshBalances();
                  }}
                  isMiniApp={isEffectivelyMiniApp}
                  farcasterAddress={currentAddress}
                  farcasterIsConnected={walletIsConnected}
                />
              </>
            )}
          </div>
        )}

        {showConnectPoolButton && (
          <ConnectPoolButton
            stakingPoolAddress={stakingPoolAddress as `0x${string}`}
            onSuccess={() => {
              setIsConnectedToPool(true);
              refreshBalances();
            }}
            isMiniApp={isEffectivelyMiniApp}
            farcasterAddress={currentAddress}
            farcasterIsConnected={walletIsConnected}
          />
        )}
      </div>
    </div>
  );
}
