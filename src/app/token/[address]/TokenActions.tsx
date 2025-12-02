"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSafeWalletAuth } from "@/src/hooks/useSafeWallet";
import { Token } from "@/src/app/types/token";
import { StakeButton } from "@/src/components/StakeButton";
import { publicClient } from "@/src/lib/viemClient";
import { UnstakeButton } from "@/src/components/UnstakeButton";
import { ConnectPoolButton } from "@/src/components/ConnectPoolButton";
import { ZapStakeButton } from "@/src/components/ZapStakeButton";
import { SwapButton } from "@/src/components/SwapButton";
import { LiquidityWarning } from "@/src/components/LiquidityWarning";
import { Wallet } from "lucide-react";
import { LP_FACTORY_ADDRESS, LP_FACTORY_ABI } from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useUnifiedWallet } from "@/src/hooks/useUnifiedWallet";
import { Button as UiButton } from "@/src/components/ui/button";
import { parseEther, parseUnits } from "viem";
import { useTokenBalance } from "@/src/hooks/useTokenData";
import { useTokenData } from "@/src/contexts/TokenPageContext";
import { useTokenPrice } from "@/src/hooks/useTokenPrice";

// Base USDC contract address
const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

interface TokenActionsProps {
  token: Token;
  onStakingChange: () => void;
  onStakedBalanceUpdate?: (balance: bigint) => void;
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
  onStakedBalanceUpdate,
  isMiniAppView: isMiniAppViewProp,
  address: addressProp,
  isConnected: isConnectedProp,
}: TokenActionsProps) {
  // Use shared token data from context, fall back to prop for compatibility
  const { token: contextToken } = useTokenData();
  const token = contextToken || initialToken;

  // Use shared token data hook instead of individual state
  const {
    tokenBalance: balance,
    ethBalance,
    stakedBalance,
    isConnectedToPool,
    refresh: refreshTokenData,
    isRefreshing: isRefreshingBalances,
    lastUpdated,
  } = useTokenBalance(
    token?.contract_address,
    token?.staking_address,
    token?.staking_pool
  );

  // USDC balance tracking
  const { tokenBalance: usdcBalance } = useTokenBalance(
    USDC_BASE_ADDRESS,
    undefined,
    undefined
  );

  // Trading interface state
  const [tradeDirection, setTradeDirection] = useState<"buy" | "sell">("buy");
  const [tradeCurrency, setTradeCurrency] = useState<"ETH" | "USDC">("ETH"); // Will be updated based on context
  const [tradeAmount, setTradeAmount] = useState(""); // Start empty, will be set by useEffect
  const [priceQuote, setPriceQuote] = useState<{
    buyAmount: string;
    sellAmount: string;
    liquidityAvailable: boolean;
  } | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Use centralized price cache for token prices, separate logic for ETH
  const { price: tokenPrice } = useTokenPrice(token?.contract_address, {
    refreshInterval: 300000, // 5 minutes  
    autoRefresh: true,
  });

  // ETH price - use separate state since useTokenPrice doesn't handle ETH
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  // Fetch ETH price using original method
  useEffect(() => {
    const fetchETHPrice = async () => {
      try {
        const response = await fetch("/api/eth-price");
        if (response.ok) {
          const data = await response.json();
          setEthPrice(data.eth || null);
        }
      } catch (error) {
        console.warn("Error fetching ETH price:", error);
      }
    };

    fetchETHPrice();
    const interval = setInterval(fetchETHPrice, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Helper function to format USD values (replaces convertToUSD)
  const formatUSD = (amount: string | number, price: number | null): string | null => {
    if (!price || !amount) return null;

    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount <= 0) return null;

    const usdValue = numAmount * price;

    if (usdValue < 0.01) {
      return `$${usdValue.toFixed(6)}`;
    } else if (usdValue < 1) {
      return `$${usdValue.toFixed(4)}`;
    } else {
      return `$${usdValue.toFixed(2)}`;
    }
  };

  // Create stable references for contract addresses to prevent unnecessary re-renders
  const stakingPoolAddress = useMemo(() => {
    console.log(
      "stakingPoolAddress memoized value changed:",
      token?.staking_pool
    );
    return token?.staking_pool;
  }, [token?.staking_pool]);

  const contractAddress = useMemo(() => {
    console.log(
      "contractAddress memoized value changed:",
      token?.contract_address
    );
    return token?.contract_address;
  }, [token?.contract_address]);

  const stakingAddress = useMemo(() => {
    console.log(
      "stakingAddress memoized value changed:",
      token?.staking_address
    );
    return token?.staking_address;
  }, [token?.staking_address]);

  const { isSDKLoaded: fcSDKLoaded, farcasterContext } = useAppFrameLogic();

  const { ready: walletReady } = useSafeWalletAuth();

  // Use unified wallet connection logic
  const {
    isConnected: unifiedIsConnected,
    address: unifiedAddress,
    connect: unifiedConnect,
    isEffectivelyMiniApp: unifiedIsMiniApp,
    isLoading: unifiedIsLoading,
  } = useUnifiedWallet();

  // Override with props if provided (for component-level control)
  const isEffectivelyMiniApp = isMiniAppViewProp ?? unifiedIsMiniApp;
  const currentAddress = addressProp ?? unifiedAddress;
  const walletIsConnected = isConnectedProp ?? unifiedIsConnected;
  const effectiveLogin = unifiedConnect;

  // Set USDC as default for Base mini-app (clientFid 309857)
  useEffect(() => {
    if (farcasterContext?.client?.clientFid === 309857) {
      setTradeCurrency("USDC");
    }
  }, [farcasterContext?.client?.clientFid]);

  // Auto-connect to Farcaster wallet if not connected in mini app context
  const autoConnectAttempted = useRef(false);
  useEffect(() => {
    if (
      isEffectivelyMiniApp &&
      fcSDKLoaded &&
      !walletIsConnected &&
      !autoConnectAttempted.current
    ) {
      autoConnectAttempted.current = true;
      console.log(
        "[TokenActions] Mini-app detected but not connected, attempting to connect..."
      );

      try {
        effectiveLogin();
        console.log("[TokenActions] Auto-connection attempt initiated");
      } catch (error) {
        console.log("[TokenActions] Auto-connection failed:", error);
      }
    }

    // Reset if we become disconnected
    if (!isEffectivelyMiniApp || !fcSDKLoaded) {
      autoConnectAttempted.current = false;
    }
  }, [isEffectivelyMiniApp, fcSDKLoaded, walletIsConnected, effectiveLogin]);

  // Enhanced 0x API integration
  const getGaslessQuote = useCallback(
    async (amount: string, direction: "buy" | "sell") => {
      if (!currentAddress || !amount || parseFloat(amount) <= 0) return null;

      setIsPriceLoading(true);
      try {
        let sellToken: string;
        let buyToken: string;
        let sellAmount: string;

        if (direction === "buy") {
          // Currency -> Token swap
          if (tradeCurrency === "ETH") {
            const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
            sellToken = ETH_ADDRESS;
            sellAmount = parseEther(amount).toString();
          } else {
            sellToken = USDC_BASE_ADDRESS;
            sellAmount = parseUnits(amount, 6).toString(); // USDC has 6 decimals
          }
          buyToken = contractAddress;
        } else {
          // Token -> Currency swap
          sellToken = contractAddress;
          sellAmount = parseEther(amount).toString();

          if (tradeCurrency === "ETH") {
            const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
            buyToken = ETH_ADDRESS;
          } else {
            buyToken = USDC_BASE_ADDRESS;
          }
        }

        const params = new URLSearchParams({
          chainId: "8453",
          sellToken,
          buyToken,
          sellAmount,
          taker: currentAddress,
        });

        const response = await fetch(`/api/price?${params.toString()}`);
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
    [currentAddress, contractAddress, tradeCurrency]
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
  }, [tradeAmount, tradeDirection, tradeCurrency, getGaslessQuote]);

  // Validation for trade amount
  const getTradeValidation = useCallback(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      return { isValid: true, error: null };
    }

    // Don't show validation errors while balances are still loading or data hasn't been loaded yet
    if (isRefreshingBalances || !lastUpdated) {
      return { isValid: true, error: null };
    }

    const amount = parseFloat(tradeAmount);
    const PRECISION_TOLERANCE = 1e-8; // Small tolerance for floating point comparison

    if (tradeDirection === "buy") {
      if (tradeCurrency === "ETH") {
        const availableEth = Number(ethBalance) / 1e18;
        if (amount > availableEth + PRECISION_TOLERANCE) {
          return {
            isValid: false,
            error: `Insufficient ETH balance. You have ${availableEth.toFixed(
              4
            )} ETH available.`,
          };
        }
      } else {
        const availableUsdc = Number(usdcBalance) / 1e6; // USDC has 6 decimals
        if (amount > availableUsdc + PRECISION_TOLERANCE) {
          return {
            isValid: false,
            error: `Insufficient USDC balance. You have ${availableUsdc.toFixed(
              2
            )} USDC available.`,
          };
        }
      }
    } else {
      const availableTokens = Number(balance) / 1e18;
      if (amount > availableTokens + PRECISION_TOLERANCE) {
        return {
          isValid: false,
          error: `Insufficient ${
            token.symbol
          } balance. You have ${availableTokens.toFixed(6)} ${
            token.symbol
          } available.`,
        };
      }
    }

    return { isValid: true, error: null };
  }, [
    tradeAmount,
    tradeDirection,
    tradeCurrency,
    ethBalance,
    usdcBalance,
    balance,
    token.symbol,
    isRefreshingBalances,
    lastUpdated,
  ]);

  const validation = getTradeValidation();


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
          (d) => d.token?.toLowerCase() === contractAddress?.toLowerCase()
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

  const hasTokens = walletIsConnected && balance > 0n;

  // Update parent component with staked balance changes
  useEffect(() => {
    if (onStakedBalanceUpdate) {
      onStakedBalanceUpdate(stakedBalance);
    }
  }, [stakedBalance, onStakedBalanceUpdate]);

  // Trigger an immediate refresh when wallet connects for the first time
  useEffect(() => {
    if (walletIsConnected && currentAddress && !lastUpdated) {
      // Immediately refresh when wallet first connects
      refreshTokenData();
    }
  }, [walletIsConnected, currentAddress, lastUpdated, refreshTokenData]);

  const refreshBalances = useCallback(async () => {
    // Use shared data refresh function
    await refreshTokenData();
    onStakingChange();
  }, [refreshTokenData, onStakingChange]);

  // Helper function to calculate amount based on percentage
  const calculatePercentageAmount = useCallback(
    (percentage: number) => {
      if (tradeDirection === "buy") {
        // For buying, use percentage of selected currency balance
        if (tradeCurrency === "ETH") {
          const ethAmount = Number(ethBalance) / 1e18;
          return ((ethAmount * percentage) / 100).toFixed(6);
        } else {
          const usdcAmount = Number(usdcBalance) / 1e6;
          return ((usdcAmount * percentage) / 100).toFixed(2);
        }
      } else {
        // For selling, use percentage of token balance
        const tokenAmount = Number(balance) / 1e18;

        // Special case for 100% - use exact balance to avoid floating point issues
        if (percentage === 100) {
          return tokenAmount.toFixed(6);
        }

        const calculatedAmount = (tokenAmount * percentage) / 100;
        return calculatedAmount.toFixed(6);
      }
    },
    [tradeDirection, tradeCurrency, ethBalance, usdcBalance, balance]
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

  // Reset to default amount when switching trade direction or currency
  useEffect(() => {
    if (tradeDirection === "buy") {
      if (tradeCurrency === "ETH") {
        setTradeAmount("0.001"); // Default to 0.001 ETH for buying
      } else {
        setTradeAmount("10"); // Default to 10 USDC for buying
      }
    } else {
      setTradeAmount(""); // Clear amount for selling
    }
  }, [tradeDirection, tradeCurrency]);

  // Initialize trade amount on component mount
  useEffect(() => {
    if (tradeDirection === "buy") {
      if (tradeCurrency === "ETH") {
        setTradeAmount("0.001");
      } else {
        setTradeAmount("10");
      }
    }
  }, [tradeDirection, tradeCurrency]); // Only run on mount or when these change

  // Periodic balance refresh
  useEffect(() => {
    if (!walletIsConnected || !currentAddress) return;

    // Refresh balances every 30 seconds
    const intervalId = setInterval(() => {
      refreshBalances();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [walletIsConnected, currentAddress, refreshBalances]);

  // USD prices are now handled by useTokenPrice hooks above

  // Show loading state if wallet is initializing
  if (
    unifiedIsLoading ||
    (isEffectivelyMiniApp && !fcSDKLoaded) ||
    (!isEffectivelyMiniApp && !walletReady)
  ) {
    return (
      <div className="card bg-base-100 border border-black/[.1]1]">
        <div className="card-body items-center justify-center min-h-[100px]">
          <span className="loading loading-spinner loading-sm"></span>
          <p className="text-sm text-base-content/70">
            {isEffectivelyMiniApp
              ? "Loading Farcaster SDK..."
              : "Initializing wallet..."}
          </p>
        </div>
      </div>
    );
  }

  if (!walletIsConnected) {
    return (
      <div className="card bg-base-100 border border-black/[.1]1]">
        <div className="card-body items-center">
          <div className="mb-4 text-center">
            <Wallet size={48} className="mx-auto mb-2 text-base-content/40" />
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

  return (
    <div className="bg-base-100 rounded-xl border border-base-300 shadow-sm">
      <div className="p-6 space-y-4">
        {/* Trading Interface */}
        <div className="space-y-4">
          {/* Buy/Sell Toggle */}
          <div className="bg-base-200 rounded-lg p-1 flex">
            <button
              onClick={() => setTradeDirection("buy")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                tradeDirection === "buy"
                  ? "bg-accent text-white"
                  : "text-base-content/70 hover:text-base-content hover:bg-base-300 cursor-pointer"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeDirection("sell")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                tradeDirection === "sell"
                  ? "bg-error text-white"
                  : "text-base-content/70 hover:text-base-content hover:bg-base-300 cursor-pointer"
              }`}
            >
              Sell
            </button>
          </div>

          {/* Available to Trade */}
          <div className="flex justify-between">
            <div className="text-sm text-base-content/50">Balance</div>
            <div className="text-sm text-base-content/50 flex items-center gap-2">
              {(isRefreshingBalances || !lastUpdated) && (
                <div className="animate-spin w-3 h-3 border border-base-300 border-t-primary rounded-full"></div>
              )}
              {!lastUpdated ? (
                <span className="text-base-content/30">Loading...</span>
              ) : tradeDirection === "buy" ? (
                tradeCurrency === "ETH" ? (
                  `${(Number(ethBalance) / 1e18).toFixed(4)} ETH`
                ) : (
                  `${(Number(usdcBalance) / 1e6).toFixed(2)} USDC`
                )
              ) : (
                `${(Number(balance) / 1e18).toFixed(4)} ${token.symbol}`
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2 mb-6">
            {/* <label className="text-sm font-medium text-gray-700">Size</label> */}
            <div className="relative">
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder={
                  tradeDirection === "buy"
                    ? tradeCurrency === "ETH"
                      ? "0.001"
                      : "10"
                    : ""
                }
                className="w-full p-5 bg-base-200 border border-base-300 rounded-lg text-base font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                step={tradeCurrency === "USDC" ? "0.01" : "0.001"}
                min="0"
              />
              {/* USD equivalent for trade amount */}
              {tradeAmount && (
                <div className="absolute left-5 top-12 text-xs text-base-content/50">
                  {tradeDirection === "buy"
                    ? tradeCurrency === "ETH"
                      ? formatUSD(tradeAmount, ethPrice)
                      : null // Don't show USD equivalent for USDC
                    : tradeDirection === "sell"
                    ? formatUSD(tradeAmount, tokenPrice)
                    : null}
                </div>
              )}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {tradeDirection === "buy" ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setTradeCurrency(
                          tradeCurrency === "ETH" ? "USDC" : "ETH"
                        )
                      }
                      className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-primary/20 transition-all text-primary flex items-center gap-1.5 group"
                    >
                      <span>{tradeCurrency}</span>
                      <svg
                        className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <span className="text-base-content/70 font-medium">
                    {token.symbol}
                  </span>
                )}
              </div>
            </div>

            {/* Percentage Buttons */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              {tradeDirection === "buy"
                ? // Fixed amounts for buying based on currency
                  tradeCurrency === "ETH"
                  ? [0.001, 0.01, 0.1, 1].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleFixedAmountClick(amount)}
                        className="py-1 px-2 text-xs rounded-md border border-base-300 hover:border-base-400 hover:bg-base-200 transition-colors text-base-content/70 cursor-pointer"
                      >
                        {amount} ETH
                      </button>
                    ))
                  : [5, 10, 100, 1000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleFixedAmountClick(amount)}
                        className="py-1 px-2 text-xs rounded-md border border-base-300 hover:border-base-400 hover:bg-base-200 transition-colors text-base-content/70 cursor-pointer"
                      >
                        ${amount}
                      </button>
                    ))
                : // Percentage buttons for selling
                  [25, 50, 75, 100].map((percentage) => (
                    <button
                      key={percentage}
                      onClick={() => handlePercentageClick(percentage)}
                      className="py-1 px-2 text-xs font-medium rounded-md border border-base-300 hover:border-base-400 hover:bg-base-200 transition-colors text-base-content/70 cursor-pointer"
                    >
                      {percentage}%
                    </button>
                  ))}
            </div>
          </div>

          {/* Quote Display */}
          {isPriceLoading ? (
            <div className="text-center text-base-content/70">
              <div className="animate-spin w-5 h-5 border-2 border-base-300 border-t-primary rounded-full mx-auto"></div>
              {/* <div className="text-sm mt-1">Getting quote...</div> */}
            </div>
          ) : priceQuote && tradeAmount ? (
            <div className="bg-base-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span>Receive:</span>
                <div className="text-right">
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
                    {tradeDirection === "buy" ? token.symbol : tradeCurrency}
                  </span>
                  {/* USD equivalent for receive amount */}
                  {(() => {
                    // Don't show USD equivalent when:
                    // 1. Receiving USDC (it's redundant)
                    // 2. Buying with USDC (confusing to show lower USD value)
                    if (
                      (tradeDirection === "sell" && tradeCurrency === "USDC") ||
                      (tradeDirection === "buy" && tradeCurrency === "USDC")
                    ) {
                      return null;
                    }

                    const amount = Number(priceQuote.buyAmount) / 1e18;
                    const price =
                      tradeDirection === "buy"
                        ? tokenPrice
                        : ethPrice;

                    return formatUSD(amount, price) ? (
                      <div className="text-xs text-base-content/50 mt-1">
                        ≈ {formatUSD(amount, price)}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          ) : null}

          {/* Validation Error Display */}
          {validation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {validation.error}
            </div>
          )}

          {/* Liquidity Warning - only show for buy direction */}
          {tradeDirection === "buy" && (
            <LiquidityWarning
              tokenAddress={contractAddress}
              tokenLaunchTime={
                token.timestamp
                  ? new Date(
                      token.timestamp._seconds * 1000 +
                        token.timestamp._nanoseconds / 1000000
                    )
                  : token.created_at
              }
              tokenSymbol={token.symbol}
              className="mb-4"
              pair={token.pair}
              type={token.type}
              poolAddress={token.pool_address}
            />
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Swap Button */}
            <SwapButton
              tokenAddress={contractAddress as `0x${string}`}
              direction={tradeDirection}
              amount={tradeAmount}
              quote={priceQuote}
              symbol={token.symbol}
              currency={tradeCurrency}
              onSuccess={() => {
                refreshBalances();
                // Reset to appropriate default based on trade direction and currency
                if (tradeDirection === "buy") {
                  setTradeAmount(tradeCurrency === "ETH" ? "0.001" : "10");
                } else {
                  setTradeAmount("");
                }
              }}
              disabled={!validation.isValid}
              className={`w-full btn ${
                tradeDirection === "buy"
                  ? "border-accent bg-accent/20 hover:bg-accent/30 disabled:!opacity-40 disabled:!border-accent disabled:!bg-accent/5 disabled:!text-accent-content disabled:cursor-not-allowed"
                  : "border-error bg-error/10 hover:bg-error/20 disabled:!opacity-40 disabled:!border-error disabled:!bg-error/10 disabled:!text-error-content disabled:cursor-not-allowed"
              }`}
            />
          </div>
          {/* Buy & Stake Button (only for buy direction) */}
          {tradeDirection === "buy" && tradeCurrency !== "USDC" && stakingAddress && (
            <ZapStakeButton
              tokenAddress={contractAddress as `0x${string}`}
              stakingAddress={stakingAddress as `0x${string}`}
              symbol={token.symbol}
              pair={token.pair}
              lpType={token.type === "v2aero" ? "aero" : "uniswap"}
              onSuccess={() => {
                refreshBalances();
                onStakingChange();
                setTradeAmount(tradeCurrency === "ETH" ? "0.001" : "10"); // Reset to default amount
              }}
              disabled={!stakingAddress || !validation.isValid}
              isMiniApp={isEffectivelyMiniApp}
              farcasterAddress={currentAddress}
              farcasterIsConnected={!!walletIsConnected}
              amount={tradeAmount}
              className="w-full btn btn-outline relative before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f] before:opacity-30 hover:before:opacity-40 border-[#ffa647]/30 hover:border-[#ffa647]/50 shadow-[0_0_5px_rgba(255,166,71,0.3)] hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]"
            />
          )}
        </div>
        <div className="my-6 h-px bg-base-300" />
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
            className="btn btn-outline border-base-300 hover:border-base-400 text-base-content hover:text-base-content bg-base-100 hover:bg-base-200 w-full disabled:border-base-200 disabled:text-base-content/40 disabled:bg-base-100"
            tokenBalance={balance}
            lockDuration={token.staking?.lockDuration}
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
          lockDuration={token.staking?.lockDuration}
          className="btn btn-outline border-base-300 hover:border-base-400 text-base-content hover:text-base-content bg-base-100 hover:bg-base-200 w-full disabled:border-base-200 disabled:text-base-content/40 disabled:bg-base-100"
        />

        {/* Pool Connection Status Indicator */}
        {stakingPoolAddress && (
          <div className="bg-base-200 rounded-lg p-3 border border-base-300">
            <div className="flex items-center gap-2 justify-center">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnectedToPool ? "bg-green-500" : "bg-amber-500"
                }`}
              ></div>
              <span className="text-sm font-medium text-base-content">
                {isConnectedToPool
                  ? "Connected to reward pool"
                  : "Not connected to reward pool"}
              </span>
            </div>
            {!isConnectedToPool && stakedBalance > 0n && (
              <>
                <p className="text-xs text-base-content/60 mb-3">
                  Connect to start receiving rewards on your staked tokens
                </p>
                <ConnectPoolButton
                  stakingPoolAddress={stakingPoolAddress as `0x${string}`}
                  onSuccess={() => {
                    refreshBalances();
                  }}
                  isMiniApp={isEffectivelyMiniApp}
                  farcasterAddress={currentAddress}
                  farcasterIsConnected={!!walletIsConnected}
                />
              </>
            )}
          </div>
        )}

        {showConnectPoolButton && (
          <ConnectPoolButton
            stakingPoolAddress={stakingPoolAddress as `0x${string}`}
            onSuccess={() => {
              refreshBalances();
            }}
          />
        )}
      </div>
    </div>
  );
}
