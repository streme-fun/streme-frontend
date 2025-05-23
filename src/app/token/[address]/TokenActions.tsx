"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Token } from "@/src/app/types/token";
import { StakeButton } from "@/src/components/StakeButton";
import { UniswapModal } from "@/src/components/UniswapModal";
import { publicClient } from "@/src/lib/viemClient";
import { UnstakeButton } from "@/src/components/UnstakeButton";
import { ConnectPoolButton } from "@/src/components/ConnectPoolButton";
import { ZapStakeButton } from "@/src/components/ZapStakeButton";
import { Wallet } from "lucide-react";
import {
  LP_FACTORY_ADDRESS,
  LP_FACTORY_ABI,
  GDA_FORWARDER,
  GDA_ABI,
} from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { Button as UiButton } from "@/src/components/ui/button";
import { useAccount, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";

interface TokenActionsProps {
  token: Token;
  onStakingChange: () => void;
  isMiniAppView?: boolean;
  address?: `0x${string}` | undefined;
  isConnected?: boolean;
  isOnCorrectNetwork?: boolean;
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
  isOnCorrectNetwork: isOnCorrectNetworkProp,
}: TokenActionsProps) {
  const [isUniswapOpen, setIsUniswapOpen] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isConnectedToPool, setIsConnectedToPool] = useState(false);
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);

  // Create stable references for contract addresses to prevent unnecessary re-renders
  const stakingPoolAddress = useMemo(() => {
    console.log(
      "stakingPoolAddress memoized value changed:",
      token.staking_pool
    );
    return token.staking_pool;
  }, [token.staking_pool]);

  const contractAddress = useMemo(() => {
    console.log(
      "contractAddress memoized value changed:",
      token.contract_address
    );
    return token.contract_address;
  }, [token.contract_address]);

  const stakingAddress = useMemo(() => {
    console.log(
      "stakingAddress memoized value changed:",
      token.staking_address
    );
    return token.staking_address;
  }, [token.staking_address]);

  const {
    isSDKLoaded: fcSDKLoaded,
    isMiniAppView: detectedMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
    isOnCorrectNetwork: fcIsOnCorrectNetwork,
    connect: fcConnect,
    connectors: fcConnectors,
    switchChain: fcSwitchChain,
  } = useAppFrameLogic();

  const { user: privyUser, ready: privyReady, login: privyLogin } = usePrivy();
  const {
    address: wagmiAddress,
    isConnected: wagmiIsConnectedGlobal,
    chain: activeChain,
  } = useAccount();
  const { switchChain: wagmiSwitchNetwork } = useSwitchChain();

  const isEffectivelyMiniApp = isMiniAppViewProp ?? detectedMiniAppView;

  let currentAddress: `0x${string}` | undefined;
  let walletIsConnected: boolean;
  let onCorrectNetwork: boolean;
  let effectiveLogin: () => void;
  let effectiveSwitchNetwork: (() => void) | undefined;

  if (isEffectivelyMiniApp) {
    currentAddress = addressProp ?? fcAddress;
    walletIsConnected = isConnectedProp ?? fcIsConnected;
    onCorrectNetwork = isOnCorrectNetworkProp ?? fcIsOnCorrectNetwork;
    effectiveLogin = () => {
      if (fcConnect && fcConnectors && fcConnectors.length > 0) {
        fcConnect({ connector: fcConnectors[0] });
      } else {
        console.warn("Farcaster connect function not available");
      }
    };
    effectiveSwitchNetwork = fcSwitchChain
      ? () => fcSwitchChain({ chainId: base.id })
      : undefined;
  } else {
    currentAddress = privyUser?.wallet?.address as `0x${string}` | undefined;
    walletIsConnected =
      privyReady && !!privyUser?.wallet?.address && wagmiIsConnectedGlobal;
    onCorrectNetwork = activeChain?.id === base.id;
    effectiveLogin = privyLogin;
    effectiveSwitchNetwork = wagmiSwitchNetwork
      ? () => wagmiSwitchNetwork({ chainId: base.id })
      : undefined;
  }

  useEffect(() => {
    console.log("TokenActions Wallet state:", {
      isEffectivelyMiniApp,
      fcSDKLoaded,
      privyReady,
      currentAddress,
      walletIsConnected,
      onCorrectNetwork,
      detectedMiniAppView,
      isMiniAppViewProp,
      fcAddress,
      fcIsConnected,
      fcIsOnCorrectNetwork,
      privyUserAddress: privyUser?.wallet?.address,
      wagmiAddress,
      wagmiIsConnectedGlobal,
      activeChainId: activeChain?.id,
    });
  }, [
    isEffectivelyMiniApp,
    fcSDKLoaded,
    privyReady,
    currentAddress,
    walletIsConnected,
    onCorrectNetwork,
    detectedMiniAppView,
    isMiniAppViewProp,
    fcAddress,
    fcIsConnected,
    fcIsOnCorrectNetwork,
    privyUser?.wallet?.address,
    wagmiAddress,
    wagmiIsConnectedGlobal,
    activeChain?.id,
  ]);

  useEffect(() => {
    const addressToFetch = initialToken.contract_address;
    const fetchTokenData = async () => {
      try {
        console.log("Fetching token data for:", addressToFetch);
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
        setStakedBalance(stakedVal);
      } catch (error) {
        console.error("Error checking staked balance:", error);
      }
    };
    checkStakedBalance();
  }, [currentAddress, walletIsConnected, stakingAddress]);

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
        setBalance(balVal);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };
    fetchBalance();
  }, [currentAddress, walletIsConnected, contractAddress]);

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
      setBalance(balVal);

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
        setStakedBalance(stakedVal);
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
  ]);

  if (isEffectivelyMiniApp && !fcSDKLoaded) {
    return (
      <div className="card bg-base-100 border border-black/[.1]1]">
        <div className="card-body items-center justify-center min-h-[100px]">
          <span className="loading loading-spinner loading-sm"></span>
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

  if (!walletIsConnected || !onCorrectNetwork) {
    return (
      <div className="card bg-base-100 border border-black/[.1]1]">
        <div className="card-body items-center">
          <div className="mb-4 text-center">
            <Wallet size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="font-semibold">
              {isEffectivelyMiniApp ? "Farcaster Wallet" : "Wallet"} Not
              Connected
            </p>
            {!onCorrectNetwork && walletIsConnected && (
              <p className="text-xs text-red-500 mt-1">
                Please switch to Base network.
              </p>
            )}
          </div>
          <UiButton
            onClick={
              walletIsConnected && !onCorrectNetwork && effectiveSwitchNetwork
                ? effectiveSwitchNetwork
                : effectiveLogin
            }
            className="btn btn-primary btn-sm w-full"
            disabled={
              walletIsConnected && !onCorrectNetwork && !effectiveSwitchNetwork
            }
          >
            {walletIsConnected && !onCorrectNetwork
              ? "Switch Network"
              : isEffectivelyMiniApp
              ? "Connect Farcaster Wallet"
              : "Connect Wallet"}
          </UiButton>
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
        {stakingAddress && (
          <ZapStakeButton
            tokenAddress={contractAddress as `0x${string}`}
            stakingAddress={stakingAddress as `0x${string}`}
            symbol={token.symbol}
            onSuccess={() => {
              refreshBalances();
              onStakingChange();
            }}
            disabled={!stakingAddress}
            isMiniApp={isEffectivelyMiniApp}
            farcasterAddress={currentAddress}
            farcasterIsConnected={walletIsConnected}
            className="w-full btn btn-outline relative before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f] before:opacity-30 hover:before:opacity-40 border-[#ffa647]/30 hover:border-[#ffa647]/50 shadow-[0_0_5px_rgba(255,166,71,0.3)] hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]"
          />
        )}

        {!isEffectivelyMiniApp && (
          <button
            className="btn btn-outline border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 w-full"
            onClick={() => setIsUniswapOpen(true)}
          >
            Swap
          </button>
        )}

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
            className="btn btn-outline border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 w-full"
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

        {!isEffectivelyMiniApp && (
          <UniswapModal
            isOpen={isUniswapOpen}
            onClose={() => setIsUniswapOpen(false)}
            tokenAddress={contractAddress}
            symbol={token.symbol}
          />
        )}

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
