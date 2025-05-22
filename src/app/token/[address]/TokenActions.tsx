"use client";

import { useState, useEffect, useCallback } from "react";
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
            setToken(result.data);
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
        tokenAddress: token.contract_address,
      });
      try {
        const deployments = (await publicClient.readContract({
          address: LP_FACTORY_ADDRESS,
          abi: LP_FACTORY_ABI,
          functionName: "getTokensDeployedByUser",
          args: [currentAddress as `0x${string}`],
        })) as Deployment[];
        const isCreatorResult = deployments.some(
          (d) => d.token.toLowerCase() === token.contract_address.toLowerCase()
        );
        if (isCreatorResult) {
          console.log("User is creator of this token");
        }
      } catch (error) {
        console.error("Error checking creator status:", error);
      }
    };
    checkIsCreator();
  }, [currentAddress, walletIsConnected, token.contract_address]);

  useEffect(() => {
    const checkPoolConnection = async () => {
      if (!currentAddress || !walletIsConnected) {
        console.log(
          "TokenActions: Pool Connection Check: Skipping, no currentAddress or wallet not connected.",
          { currentAddressPresent: !!currentAddress, walletIsConnected }
        );
        setIsConnectedToPool(false);
        return;
      }
      if (!token.staking_pool) {
        console.log(
          `TokenActions: Pool Connection Check: Skipping, no token.staking_pool defined for token ${token.contract_address}`
        );
        setIsConnectedToPool(false);
        return;
      }

      try {
        console.log(
          `TokenActions: Pool Connection Check: Reading GDA_FORWARDER.isMemberConnected for pool ${token.staking_pool}, member ${currentAddress}`
        );
        const connectedStatus = await publicClient.readContract({
          address: GDA_FORWARDER,
          abi: GDA_ABI,
          functionName: "isMemberConnected",
          args: [
            token.staking_pool as `0x${string}`,
            currentAddress as `0x${string}`,
          ],
        });
        console.log(
          `TokenActions: Pool Connection Check: Status for pool ${token.staking_pool}, member ${currentAddress} is ${connectedStatus}`
        );
        setIsConnectedToPool(connectedStatus);
      } catch (error) {
        console.error(
          `TokenActions: Pool Connection Check: Error for pool ${token.staking_pool}, member ${currentAddress}`,
          error
        );
        setIsConnectedToPool(false);
      }
    };
    checkPoolConnection();
  }, [
    currentAddress,
    walletIsConnected,
    token.staking_pool,
    token.contract_address,
  ]);

  useEffect(() => {
    const checkStakedBalance = async () => {
      if (!currentAddress || !walletIsConnected || !token.staking_address)
        return;
      try {
        const stakedVal = await publicClient.readContract({
          address: token.staking_address as `0x${string}`,
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
  }, [currentAddress, walletIsConnected, token.staking_address]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!currentAddress || !walletIsConnected) return;
      try {
        const balVal = await publicClient.readContract({
          address: token.contract_address as `0x${string}`,
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
  }, [currentAddress, walletIsConnected, token.contract_address]);

  const hasTokens = walletIsConnected && balance > 0n;

  const refreshBalances = useCallback(async () => {
    if (!currentAddress || !walletIsConnected) return;
    try {
      const balVal = await publicClient.readContract({
        address: token.contract_address as `0x${string}`,
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

      if (token.staking_address) {
        const stakedVal = await publicClient.readContract({
          address: token.staking_address as `0x${string}`,
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
    token.contract_address,
    token.staking_address,
    onStakingChange,
  ]);

  if (isEffectivelyMiniApp && !fcSDKLoaded) {
    return (
      <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
        <div className="card-body items-center justify-center min-h-[100px]">
          <span className="loading loading-spinner loading-sm"></span>
        </div>
      </div>
    );
  }

  if (!isEffectivelyMiniApp && !privyReady) {
    return (
      <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
        <div className="card-body items-center justify-center min-h-[100px]">
          <span className="loading loading-spinner loading-sm"></span>
          <p className="text-sm text-gray-500">Initializing wallet...</p>
        </div>
      </div>
    );
  }

  if (!walletIsConnected || !onCorrectNetwork) {
    return (
      <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
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
    token.staking_pool &&
    stakedBalance === 0n &&
    !isConnectedToPool;

  return (
    <div className="card border-gray-100 border-2 space-y-6">
      <div className="card-body space-y-1">
        {showConnectPoolButton && (
          <ConnectPoolButton
            stakingPoolAddress={token.staking_pool as `0x${string}`}
            onSuccess={() => {
              setIsConnectedToPool(true);
              refreshBalances();
            }}
            isMiniApp={isEffectivelyMiniApp}
            farcasterAddress={currentAddress}
            farcasterIsConnected={walletIsConnected}
          />
        )}

        {token.staking_address && (
          <ZapStakeButton
            tokenAddress={token.contract_address as `0x${string}`}
            stakingAddress={token.staking_address as `0x${string}`}
            symbol={token.symbol}
            onSuccess={() => {
              refreshBalances();
              onStakingChange();
            }}
            disabled={!token.staking_address}
            isMiniApp={isEffectivelyMiniApp}
            farcasterAddress={currentAddress}
            farcasterIsConnected={walletIsConnected}
            className="btn btn-outline relative  before:absolute before:inset-0 before:bg-gradient-to-r  before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f]  before:opacity-30 hover:before:opacity-40 border-[#ffa647]/30 hover:border-[#ffa647]/50 shadow-[0_0_5px_rgba(255,166,71,0.3)] hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)] w-full"
          />
        )}

        {!isEffectivelyMiniApp && (
          <button
            className="btn btn-outline border-gray-400 text-gray-600 w-full"
            onClick={() => setIsUniswapOpen(true)}
          >
            Swap
          </button>
        )}

        {token.staking_address && (
          <StakeButton
            tokenAddress={token.contract_address as `0x${string}`}
            stakingAddress={token.staking_address as `0x${string}`}
            stakingPoolAddress={token.staking_pool as `0x${string}`}
            onSuccess={() => {
              refreshBalances();
              onStakingChange();
            }}
            disabled={balance === 0n || !token.staking_address}
            symbol={token.symbol}
            className={`btn btn-outline border-gray-400 text-gray-600 w-full`}
            isMiniApp={isEffectivelyMiniApp}
            farcasterAddress={currentAddress}
            farcasterIsConnected={walletIsConnected}
          />
        )}

        <UnstakeButton
          stakingAddress={token.staking_address as `0x${string}`}
          userStakedBalance={stakedBalance}
          onSuccess={() => {
            refreshBalances();
            onStakingChange();
          }}
          disabled={stakedBalance === 0n || !token.staking_address}
          symbol={token.symbol}
          className="btn btn-primary w-full"
          isMiniApp={isEffectivelyMiniApp}
          farcasterAddress={currentAddress}
          farcasterIsConnected={walletIsConnected}
        />

        {!isEffectivelyMiniApp && (
          <UniswapModal
            isOpen={isUniswapOpen}
            onClose={() => setIsUniswapOpen(false)}
            tokenAddress={token.contract_address}
            symbol={token.symbol}
          />
        )}
      </div>
    </div>
  );
}
