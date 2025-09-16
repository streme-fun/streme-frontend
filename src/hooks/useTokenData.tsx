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
import { useSafeWalletAuth } from "./useSafeWallet";
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
  refreshActiveData: () => Promise<void>;
  registerActiveToken: (tokenAddress: string) => void;
  unregisterActiveToken: (tokenAddress: string) => void;
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
  const [activeTokens, setActiveTokens] = useState<Set<string>>(new Set());

  const { refreshTrigger, primaryAddress } = useWalletAddressChange();
  const { user } = useSafeWalletAuth();
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

  // Register a token as currently active/visible
  const registerActiveToken = useCallback((tokenAddress: string) => {
    setActiveTokens((prev) => new Set(prev).add(tokenAddress));
  }, []);

  // Unregister a token as no longer active/visible
  const unregisterActiveToken = useCallback((tokenAddress: string) => {
    setActiveTokens((prev) => {
      const newSet = new Set(prev);
      newSet.delete(tokenAddress);
      return newSet;
    });
  }, []);

  const refreshTokenData = useCallback(
    async (
      tokenAddress: string,
      stakingAddress?: string,
      poolAddress?: string
    ) => {
      if (!effectiveAddress || !isConnected) return;

      const cacheKey = `${tokenAddress}-${effectiveAddress}`;

      // Set loading state for initial data fetch
      const isInitialFetch = !balanceData.has(cacheKey);
      if (isInitialFetch) {
        setIsRefreshing(true);
      }

      try {
        // For initial fetches, use direct calls for maximum speed
        if (isInitialFetch) {
          // Direct calls for maximum speed - bypass batching for critical data
          const [tokenBalance, ethBalance] = await Promise.all([
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
            }),
            publicClient.getBalance({
              address: effectiveAddress as `0x${string}`,
            }),
          ]);

          // Update cache immediately with critical balance data
          setBalanceData(
            (prev) =>
              new Map(
                prev.set(cacheKey, {
                  tokenBalance: tokenBalance as bigint,
                  ethBalance: ethBalance as bigint,
                  stakedBalance: BigInt(0), // Will be updated below if needed
                  isConnectedToPool: false, // Will be updated below if needed
                  lastUpdated: Date.now(),
                })
              )
          );

          // Fetch secondary data in parallel without blocking
          const secondaryPromises = [];

          if (
            stakingAddress &&
            stakingAddress !== "0x0000000000000000000000000000000000000000"
          ) {
            secondaryPromises.push(
              publicClient
                .readContract({
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
                .then((stakedBalance) => {
                  setBalanceData(
                    (prev) =>
                      new Map(
                        prev.set(cacheKey, {
                          ...prev.get(cacheKey)!,
                          stakedBalance: stakedBalance as bigint,
                        })
                      )
                  );
                })
                .catch((error) => {
                  console.error("Error fetching staked balance:", error);
                })
            );
          }

          if (
            poolAddress &&
            poolAddress !== "0x0000000000000000000000000000000000000000"
          ) {
            secondaryPromises.push(
              publicClient
                .readContract({
                  address: GDA_FORWARDER,
                  abi: GDA_ABI,
                  functionName: "isMemberConnected",
                  args: [
                    poolAddress as `0x${string}`,
                    effectiveAddress as `0x${string}`,
                  ],
                })
                .then((isConnectedToPool) => {
                  setBalanceData(
                    (prev) =>
                      new Map(
                        prev.set(cacheKey, {
                          ...prev.get(cacheKey)!,
                          isConnectedToPool: isConnectedToPool as boolean,
                        })
                      )
                  );
                })
                .catch((error) => {
                  console.error("Error fetching pool connection:", error);
                })
            );
          }

          // Fire and forget secondary data
          if (secondaryPromises.length > 0) {
            Promise.all(secondaryPromises).catch(() => {
              // Ignore errors - secondary data failures shouldn't affect primary balance display
            });
          }
        } else {
          // Use batched calls for subsequent refreshes
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

          // Handle staked balance separately for batched calls
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

          // Handle pool connection separately for batched calls
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

          // Update the cache for batched calls
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
        }
      } catch (error) {
        console.error(
          `Error refreshing token data for ${tokenAddress}:`,
          error
        );
      } finally {
        // Clear loading state for initial fetch
        if (isInitialFetch) {
          setIsRefreshing(false);
        }
      }
    },
    [effectiveAddress, isConnected, balanceData]
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

  // Smart refresh: only refresh currently active/visible tokens
  const refreshActiveData = useCallback(async () => {
    if (!effectiveAddress || !isConnected || activeTokens.size === 0) return;

    setIsRefreshing(true);
    try {
      // Only refresh tokens that are currently active/visible
      const refreshPromises = Array.from(activeTokens).map((tokenAddress) => {
        return refreshTokenData(tokenAddress);
      });
      await Promise.all(refreshPromises);
    } finally {
      setIsRefreshing(false);
    }
  }, [effectiveAddress, isConnected, activeTokens, refreshTokenData]);

  // Auto-refresh every 10 minutes - use smart refresh for active tokens
  useEffect(() => {
    if (!effectiveAddress || !isConnected) return;

    const interval = setInterval(() => {
      // Use smart refresh instead of refreshing all data
      refreshActiveData();
    }, 600000);

    return () => clearInterval(interval);
  }, [effectiveAddress, isConnected, refreshActiveData]);

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
    refreshActiveData,
    registerActiveToken,
    unregisterActiveToken,
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
  const {
    balanceData,
    refreshTokenData,
    registerActiveToken,
    unregisterActiveToken,
    isRefreshing,
  } = useTokenData();
  const { primaryAddress } = useWalletAddressChange();
  const { user } = useSafeWalletAuth();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();

  const effectiveAddress = isMiniAppView
    ? fcAddress
    : primaryAddress || user?.wallet?.address;

  const cacheKey = `${tokenAddress}-${effectiveAddress}`;
  const data = balanceData.get(cacheKey);

  // Register this token as active when the hook is used
  useEffect(() => {
    if (tokenAddress) {
      registerActiveToken(tokenAddress);

      // Unregister when component unmounts or token changes
      return () => {
        unregisterActiveToken(tokenAddress);
      };
    }
  }, [tokenAddress, registerActiveToken, unregisterActiveToken]);

  // Auto-fetch if data doesn't exist - immediate and aggressive for initial load
  useEffect(() => {
    if (effectiveAddress && !data) {
      // Direct calls will be used automatically for initial fetch
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
