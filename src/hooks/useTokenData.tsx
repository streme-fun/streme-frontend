"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { publicClient, requestBatcher } from "@/src/lib/viemClient";
import { useWalletAddressChange } from "./useWalletSync";
import { useAppFrameLogic } from "./useAppFrameLogic";
import { usePrivy } from "@privy-io/react-auth";
import { GDA_FORWARDER, GDA_ABI } from "@/src/lib/contracts";

interface TokenBalanceData {
  tokenBalance: bigint;
  ethBalance: bigint;
  stakedBalance: bigint;
  isConnectedToPool: boolean;
  lastUpdated: number;
}

interface TokenDataContextType {
  balanceData: Map<string, TokenBalanceData>;
  refreshTokenData: (
    tokenAddress: string,
    stakingAddress?: string,
    poolAddress?: string
  ) => Promise<void>;
  refreshAllData: () => Promise<void>;
  isRefreshing: boolean;
}

const TokenDataContext = createContext<TokenDataContextType | null>(null);

interface TokenDataProviderProps {
  children: ReactNode;
}

export function TokenDataProvider({ children }: TokenDataProviderProps) {
  const [balanceData, setBalanceData] = useState<Map<string, TokenBalanceData>>(
    new Map()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refreshTrigger, primaryAddress } = useWalletAddressChange();
  const { user } = usePrivy();
  const {
    isMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
  } = useAppFrameLogic();

  // Get effective address based on context
  const effectiveAddress = isMiniAppView
    ? fcAddress
    : primaryAddress || user?.wallet?.address;
  const isConnected = isMiniAppView ? fcIsConnected : !!user?.wallet?.address;

  const refreshTokenData = useCallback(
    async (
      tokenAddress: string,
      stakingAddress?: string,
      poolAddress?: string
    ) => {
      if (!effectiveAddress || !isConnected) return;

      const cacheKey = `${tokenAddress}-${effectiveAddress}`;

      try {
        // Batch the most common calls that have the same return type
        const [tokenBalance, ethBalance] = await Promise.all([
          requestBatcher.batchContractRead(`token-balance-${cacheKey}`, () =>
            publicClient.readContract({
              address: tokenAddress as `0x${string}`,
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
              args: [effectiveAddress as `0x${string}`],
            })
          ),
          requestBatcher.batchContractRead(
            `eth-balance-${effectiveAddress}`,
            () =>
              publicClient.getBalance({
                address: effectiveAddress as `0x${string}`,
              })
          ),
        ]);

        // Handle staked balance separately
        let stakedBalance = BigInt(0);
        if (
          stakingAddress &&
          stakingAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          stakedBalance = (await requestBatcher.batchContractRead(
            `staked-balance-${stakingAddress}-${effectiveAddress}`,
            () =>
              publicClient.readContract({
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
                args: [effectiveAddress as `0x${string}`],
              })
          )) as bigint;
        }

        // Handle pool connection separately
        let isConnectedToPool = false;
        if (
          poolAddress &&
          poolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          isConnectedToPool = (await requestBatcher.batchContractRead(
            `pool-connection-${poolAddress}-${effectiveAddress}`,
            () =>
              publicClient.readContract({
                address: GDA_FORWARDER,
                abi: GDA_ABI,
                functionName: "isMemberConnected",
                args: [
                  poolAddress as `0x${string}`,
                  effectiveAddress as `0x${string}`,
                ],
              })
          )) as boolean;
        }

        // Update the cache
        setBalanceData(
          (prev) =>
            new Map(
              prev.set(cacheKey, {
                tokenBalance: tokenBalance as bigint,
                ethBalance: ethBalance as bigint,
                stakedBalance,
                isConnectedToPool,
                lastUpdated: Date.now(),
              })
            )
        );
      } catch (error) {
        console.error(
          `Error refreshing token data for ${tokenAddress}:`,
          error
        );
      }
    },
    [effectiveAddress, isConnected]
  );

  const refreshAllData = useCallback(async () => {
    if (!effectiveAddress || !isConnected) return;

    setIsRefreshing(true);
    try {
      // Refresh all cached token data
      const refreshPromises = Array.from(balanceData.keys()).map((key) => {
        const tokenAddress = key.split("-")[0];
        return refreshTokenData(tokenAddress);
      });
      await Promise.all(refreshPromises);
    } finally {
      setIsRefreshing(false);
    }
  }, [effectiveAddress, isConnected, balanceData, refreshTokenData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    if (!effectiveAddress || !isConnected || balanceData.size === 0) return;

    const interval = setInterval(() => {
      refreshAllData();
    }, 600000);

    return () => clearInterval(interval);
  }, [effectiveAddress, isConnected, balanceData.size, refreshAllData]);

  // Refresh on wallet change
  useEffect(() => {
    if (effectiveAddress && isConnected) {
      refreshAllData();
    }
  }, [refreshTrigger, effectiveAddress, isConnected]);

  const value = {
    balanceData,
    refreshTokenData,
    refreshAllData,
    isRefreshing,
  };

  return (
    <TokenDataContext.Provider value={value}>
      {children}
    </TokenDataContext.Provider>
  );
}

export function useTokenData() {
  const context = useContext(TokenDataContext);
  if (!context) {
    throw new Error("useTokenData must be used within a TokenDataProvider");
  }
  return context;
}

// Hook for specific token data
export function useTokenBalance(
  tokenAddress: string,
  stakingAddress?: string,
  poolAddress?: string
) {
  const { balanceData, refreshTokenData, isRefreshing } = useTokenData();
  const { primaryAddress } = useWalletAddressChange();
  const { user } = usePrivy();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();

  const effectiveAddress = isMiniAppView
    ? fcAddress
    : primaryAddress || user?.wallet?.address;

  const cacheKey = `${tokenAddress}-${effectiveAddress}`;
  const data = balanceData.get(cacheKey);

  // Auto-fetch if data doesn't exist
  useEffect(() => {
    if (effectiveAddress && !data) {
      refreshTokenData(tokenAddress, stakingAddress, poolAddress);
    }
  }, [
    effectiveAddress,
    tokenAddress,
    stakingAddress,
    poolAddress,
    data,
    refreshTokenData,
  ]);

  return {
    tokenBalance: data?.tokenBalance ?? BigInt(0),
    ethBalance: data?.ethBalance ?? BigInt(0),
    stakedBalance: data?.stakedBalance ?? BigInt(0),
    isConnectedToPool: data?.isConnectedToPool ?? false,
    lastUpdated: data?.lastUpdated,
    refresh: () => refreshTokenData(tokenAddress, stakingAddress, poolAddress),
    isRefreshing,
  };
}
