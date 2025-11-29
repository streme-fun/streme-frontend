"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { Modal } from "./Modal";
import { formatUnits } from "viem";
import { StakeButton } from "./StakeButton";
import { StakeAllButton } from "./StakeAllButton";
import { UnstakeButton } from "./UnstakeButton";
import { ConnectPoolButton } from "./ConnectPoolButton";
import { TopUpAllStakesButton } from "./TopUpAllStakesButton";
import { publicClient } from "../lib/viemClient";
import { GDA_FORWARDER, GDA_ABI } from "../lib/contracts";
import { useStreamingNumber } from "../hooks/useStreamingNumber";
import { useTokenData } from "../hooks/useTokenData";
import { formatMarketCap, format24hChange } from "../lib/formatUtils";
import { memo } from "react";
import { BLACKLISTED_TOKENS } from "../lib/blacklist";

interface PoolMembership {
  units: string;
  createdAtTimestamp: string;
  isConnected: boolean;
  pool: {
    id: string;
    flowRate: string;
    token: {
      id: string;
      symbol: string;
      isNativeAssetSuperToken: boolean;
    };
    totalUnits: string;
    totalMembers: string;
  };
}

interface SuperTokenData {
  tokenAddress: string;
  symbol: string;
  balance: number;
  stakingAddress?: string;
  isNativeAssetSuperToken: boolean;
  logo?: string;
  isConnectedToPool?: boolean;
  marketData?: {
    marketCap: number;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange5m: number;
    volume24h: number;
    lastUpdated: { _seconds: number; _nanoseconds: number };
  };
}

interface AccountTokenSnapshot {
  token: {
    id: string;
    symbol: string;
    isNativeAssetSuperToken: boolean;
  };
  balanceUntilUpdatedAt: string;
}

interface StakeData {
  membership: PoolMembership;
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  receivedBalance: number;
  baseAmount: number;
  lastUpdateTime: number;
  userFlowRate: number;
  stakedBalance: bigint;
  lockDuration?: number; // Lock duration in seconds (defaults to 24h for v1 tokens)
  logo?: string;
  isConnectedToPool?: boolean;
  marketData?: {
    marketCap: number;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange5m: number;
    volume24h: number;
    lastUpdated: { _seconds: number; _nanoseconds: number };
  };
}

interface MyTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Component for displaying streaming current balance
const CurrentBalanceDisplay = memo(
  ({ stake }: { stake: StakeData; isMiniApp?: boolean }) => {
    const currentBalance = useStreamingNumber({
      baseAmount: stake.baseAmount,
      flowRatePerSecond: stake.userFlowRate / 86400, // Convert daily rate to per-second
      lastUpdateTime: stake.lastUpdateTime,
      updateInterval: 60, // Use 60ms for smooth requestAnimationFrame updates
      pauseWhenHidden: true,
      isMobileOptimized: false, // Disable mobile optimization for smooth animations
    });

    return (
      <div>
        <p className="text-base-content/70">Current Balance</p>
        <div className="flex items-center">
          <p
            className="font-mono text-success"
            style={{ willChange: "contents" }}
          >
            {currentBalance.toLocaleString("en-US", {
              minimumFractionDigits: 6,
              maximumFractionDigits: 6,
            })}
            <span className="ml-1">{stake.membership.pool.token.symbol}</span>
          </p>
        </div>
      </div>
    );
  }
);

CurrentBalanceDisplay.displayName = "CurrentBalanceDisplay";

// Type for cached token data
interface CachedTokenDataItem {
  staking_address?: string;
  staking_pool?: string; // GDA pool address for filtering memberships
  logo?: string;
  staking?: {
    lockDuration?: number;
  };
  marketData?: {
    marketCap: number;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange5m: number;
    volume24h: number;
    lastUpdated: { _seconds: number; _nanoseconds: number };
  };
}

// Optimized cache with better TTL management
const tokenDataCache = new Map<
  string,
  {
    data: CachedTokenDataItem;
    timestamp: number;
  }
>();

// Unified cache with shorter TTL for better UX
const blockchainDataCache = new Map<
  string,
  {
    balance?: bigint;
    stakedBalance?: bigint;
    isConnected?: boolean;
    timestamp: number;
  }
>();

const CACHE_DURATION = 180000; // 3 minutes - shorter for better UX
const CRITICAL_CACHE_DURATION = 60000; // 1 minute for critical data

export function MyTokensModal({ isOpen, onClose }: MyTokensModalProps) {
  const { address: wagmiAddress } = useAccount();
  const {
    isMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
  } = useAppFrameLogic();

  const [stakes, setStakes] = useState<StakeData[]>([]);
  const [ownedSuperTokens, setOwnedSuperTokens] = useState<SuperTokenData[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Progressive loading states
  const [loadingPhase, setLoadingPhase] = useState<
    "initial" | "balances" | "metadata" | "complete"
  >("initial");

  // Liquidity data cache for sorting
  const [liquidityCache, setLiquidityCache] = useState<Map<string, boolean>>(
    new Map()
  );

  // Get effective address based on context
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;
  const effectiveIsConnected = isMiniAppView ? fcIsConnected : !!wagmiAddress;

  // Use centralized token data hook
  const {
    balanceData,
    refreshTokenData,
    refreshAllData,
    registerActiveToken,
    unregisterActiveToken,
  } = useTokenData();

  // Helper function to safely call toLowerCase on potentially null values
  const safeToLowerCase = (value: string | null | undefined): string => {
    if (!value || typeof value !== "string") {
      return "";
    }
    return value.toLowerCase();
  };

  // Optimized batch token data fetcher
  const fetchTokenDataBatch = async (tokenAddresses: string[]) => {
    const now = Date.now();
    const results = new Map();
    const toFetch: string[] = [];

    // Check cache first
    tokenAddresses.forEach((address) => {
      if (BLACKLISTED_TOKENS.includes(safeToLowerCase(address))) {
        results.set(address, {
          staking_address: undefined,
          staking_pool: undefined,
          logo: undefined,
          marketData: undefined,
          staking: undefined,
        });
        return;
      }

      const cached = tokenDataCache.get(address);
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        results.set(address, cached.data);
      } else {
        toFetch.push(address);
      }
    });

    // Batch fetch remaining tokens
    if (toFetch.length > 0) {
      try {
        // Split into batches of 30 (Firestore limit)
        const batches = [];
        for (let i = 0; i < toFetch.length; i += 30) {
          batches.push(toFetch.slice(i, i + 30));
        }

        // Fetch all batches in parallel
        const batchPromises = batches.map(async (batch) => {
          try {
            const response = await fetch("/api/tokens/multiple?type=all", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ tokenAddresses: batch }),
            });

            if (response.ok) {
              const result = await response.json();
              return { batch, tokens: result.tokens };
            }
            throw new Error(`HTTP ${response.status}`);
          } catch (error) {
            console.warn(`Failed to fetch batch of tokens:`, error);
            return { batch, tokens: batch.map(() => null) };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Process results
        batchResults.forEach(({ batch, tokens }) => {
          batch.forEach((address, index) => {
            const tokenData = tokens[index];
            if (tokenData) {
              const processedData = {
                staking_address: tokenData.staking_address,
                staking_pool: tokenData.staking_pool,
                logo: tokenData.img_url || tokenData.logo || tokenData.image,
                marketData: tokenData.marketData,
                // Preserve staking config so we can surface lock durations in the UI
                staking: tokenData.staking
                  ? { lockDuration: tokenData.staking.lockDuration }
                  : undefined,
              };

              // Cache the result
              tokenDataCache.set(address, {
                data: processedData,
                timestamp: now,
              });

              results.set(address, processedData);
            } else {
              // Token not found in database
              const fallbackData = {
                staking_address: undefined,
                staking_pool: undefined,
                logo: undefined,
                marketData: undefined,
                staking: undefined,
              };
              tokenDataCache.set(address, {
                data: fallbackData,
                timestamp: now,
              });
              results.set(address, fallbackData);
            }
          });
        });
      } catch (error) {
        console.error("Batch token data fetch failed:", error);
      }
    }

    return results;
  };

  // Optimized blockchain data fetcher
  const fetchBlockchainDataBatch = async (
    requests: Array<{
      type: "balance" | "stakedBalance" | "poolConnection";
      tokenAddress?: string;
      stakingAddress?: string;
      poolAddress?: string;
      userAddress?: string;
    }>
  ) => {
    const now = Date.now();
    const results = new Map();
    const toFetch: typeof requests = [];

    // Check cache first
    requests.forEach((request) => {
      const cacheKey = `${request.type}-${
        request.tokenAddress || request.stakingAddress || request.poolAddress
      }-${request.userAddress}`;
      const cached = blockchainDataCache.get(cacheKey);

      if (cached && now - cached.timestamp < CRITICAL_CACHE_DURATION) {
        results.set(cacheKey, cached);
      } else {
        toFetch.push(request);
      }
    });

    // Batch fetch remaining data
    if (toFetch.length > 0) {
      const fetchPromises = toFetch.map(async (request) => {
        const cacheKey = `${request.type}-${
          request.tokenAddress || request.stakingAddress || request.poolAddress
        }-${request.userAddress}`;

        try {
          let result: bigint | boolean | undefined;

          if (request.type === "balance" && request.tokenAddress) {
            result = (await publicClient.readContract({
              address: request.tokenAddress as `0x${string}`,
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
              args: [request.userAddress as `0x${string}`],
            })) as bigint;
          } else if (
            request.type === "stakedBalance" &&
            request.stakingAddress
          ) {
            result = (await publicClient.readContract({
              address: request.stakingAddress as `0x${string}`,
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
              args: [request.userAddress as `0x${string}`],
            })) as bigint;
          } else if (
            request.type === "poolConnection" &&
            request.poolAddress &&
            request.userAddress
          ) {
            result = (await publicClient.readContract({
              address: GDA_FORWARDER,
              abi: GDA_ABI,
              functionName: "isMemberConnected",
              args: [
                request.poolAddress as `0x${string}`,
                request.userAddress as `0x${string}`,
              ],
            })) as boolean;
          }

          const cacheData = {
            [request.type]:
              result || (request.type === "poolConnection" ? false : BigInt(0)),
            timestamp: now,
          };

          blockchainDataCache.set(cacheKey, cacheData);
          return { cacheKey, data: cacheData };
        } catch (error) {
          console.warn(`Failed to fetch ${request.type}:`, error);
          const fallbackData = {
            [request.type]:
              request.type === "poolConnection" ? false : BigInt(0),
            timestamp: now,
          };
          blockchainDataCache.set(cacheKey, fallbackData);
          return { cacheKey, data: fallbackData };
        }
      });

      const fetchResults = await Promise.allSettled(fetchPromises);
      fetchResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          results.set(result.value.cacheKey, result.value.data);
        }
      });
    }

    return results;
  };

  useEffect(() => {
    if (isOpen && effectiveAddress) {
      fetchStakesAndTokens();
    }
  }, [isOpen, effectiveAddress]);

  // Effect to trigger Phase 2 when loading phase changes to 'balances'
  useEffect(() => {
    if (loadingPhase === "balances") {
      processPhase2();
    }
  }, [loadingPhase]);

  // Effect to trigger Phase 3 when loading phase changes to 'metadata'
  useEffect(() => {
    if (loadingPhase === "metadata") {
      processPhase3();
    }
  }, [loadingPhase]);

  // Refresh staked balances for timer functionality
  const refreshStakedBalances = useCallback(async () => {
    if (!effectiveAddress || stakes.length === 0) return;

    const stakesWithStaking = stakes.filter(
      (stake) => stake.stakingAddress && stake.stakingAddress !== ""
    );

    if (stakesWithStaking.length === 0) return;

    try {
      const stakedBalanceResults = await Promise.allSettled(
        stakesWithStaking.map(async (stake) => {
          const stakedBalance = await publicClient.readContract({
            address: stake.stakingAddress as `0x${string}`,
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
          });
          return {
            tokenAddress: stake.tokenAddress,
            stakedBalance: stakedBalance as bigint,
          };
        })
      );

      // Update stakes with new staked balances
      setStakes((prevStakes) =>
        prevStakes.map((stake) => {
          const resultIndex = stakesWithStaking.findIndex(
            (s) => s.tokenAddress === stake.tokenAddress
          );
          if (resultIndex >= 0) {
            const result = stakedBalanceResults[resultIndex];
            if (result.status === "fulfilled") {
              return {
                ...stake,
                stakedBalance: result.value.stakedBalance,
              };
            }
          }
          return stake;
        })
      );
    } catch (error) {
      console.warn("Failed to refresh staked balances:", error);
    }
  }, [effectiveAddress, stakes]);

  // Refresh staked balances when modal opens (for unstake timer)
  useEffect(() => {
    if (isOpen && effectiveAddress && stakes.length > 0) {
      // Refresh once when modal opens to get current staked balances for timers
      refreshStakedBalances();
    }
  }, [isOpen, refreshStakedBalances]);

  // Create stable token list for dependencies
  const tokenAddresses = stakes
    .map((s) => s.tokenAddress)
    .concat(ownedSuperTokens.map((t) => t.tokenAddress))
    .sort()
    .join(",");

  // Register active tokens when modal is open
  useEffect(() => {
    if (isOpen) {
      const allTokens = [
        ...stakes.map((s) => s.tokenAddress),
        ...ownedSuperTokens.map((t) => t.tokenAddress),
      ];
      allTokens.forEach((token) => {
        registerActiveToken(token);
      });

      return () => {
        allTokens.forEach((token) => {
          unregisterActiveToken(token);
        });
      };
    }
  }, [isOpen, tokenAddresses, registerActiveToken, unregisterActiveToken]);

  // Update stakes when balance data changes (but only when not loading/refreshing)
  useEffect(() => {
    if (!effectiveAddress || stakes.length === 0 || loading || refreshing)
      return;

    setStakes((prevStakes) =>
      prevStakes.map((stake) => {
        const cacheKey = `${stake.tokenAddress}-${effectiveAddress}`;
        const cachedData = balanceData.get(cacheKey);

        if (cachedData && stake.stakingAddress) {
          // Only update if we have stakingAddress (stake is fully loaded)
          const formattedBalance = Number(
            formatUnits(cachedData.tokenBalance, 18)
          );
          if (Math.abs(formattedBalance - stake.baseAmount) > 0.01) {
            return {
              ...stake,
              receivedBalance: formattedBalance,
              baseAmount: formattedBalance,
              lastUpdateTime: cachedData.lastUpdated,
            };
          }
        }
        return stake;
      })
    );
  }, [balanceData, effectiveAddress, loading, refreshing]);

  const fetchStakesAndTokens = async () => {
    if (!effectiveAddress) return;

    setLoading(true);
    setError(null);
    setAccountExists(null);

    try {
      const accountId = safeToLowerCase(effectiveAddress);
      if (!accountId) {
        throw new Error("Invalid address provided");
      }

      const query = `
        query GetAccountStakes($accountId: ID!) {
          account(id: $accountId) {
            poolMemberships {
              units
              createdAtTimestamp
              isConnected
              pool {
                id
                flowRate
                token {
                  id
                  symbol
                  isNativeAssetSuperToken
                }
                totalUnits
                totalMembers
              }
            }
            accountTokenSnapshots {
              token {
                id
                symbol
                isNativeAssetSuperToken
              }
              balanceUntilUpdatedAt
            }
          }
        }
      `;

      // Simplified endpoint selection - use primary first
      const endpoints = [
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        "https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-base",
      ];

      let accountData = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables: { accountId } }),
          });

          if (!response.ok) continue;

          const data = await response.json();
          if (data.errors) continue;

          accountData = data.data?.account;
          break;
        } catch (err) {
          console.warn(`Endpoint ${endpoint} failed:`, err);
          continue;
        }
      }

      if (accountData) {
        setAccountExists(true);
        await processPhase1(accountData);
      } else {
        setAccountExists(false);
        setStakes([]);
        setOwnedSuperTokens([]);
      }
    } catch (err) {
      console.error("Error fetching stakes:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch stakes");
      setAccountExists(null);
    } finally {
      setLoading(false);
    }
  };

  // Optimized processing with progressive loading phases
  // Phase 1: Initial data processing and display
  const processPhase1 = async (accountData: {
    poolMemberships?: PoolMembership[];
    accountTokenSnapshots?: AccountTokenSnapshot[];
  }) => {
    // Reset progressive loading states
    setLoadingPhase("initial");
    // Step 1: Quick filtering and data collection
    const allTokens = new Set<string>();
    const validMemberships: PoolMembership[] = [];
    const validSnapshots: AccountTokenSnapshot[] = [];

    // Filter memberships
    if (accountData.poolMemberships) {
      accountData.poolMemberships.forEach((membership) => {
        if (
          membership.units &&
          parseFloat(membership.units) > 0 &&
          !membership.pool.token.isNativeAssetSuperToken &&
          !BLACKLISTED_TOKENS.includes(
            safeToLowerCase(membership.pool.token.id)
          )
        ) {
          allTokens.add(membership.pool.token.id);
          validMemberships.push(membership);
        }
      });
    }

    // Filter snapshots
    if (accountData.accountTokenSnapshots) {
      accountData.accountTokenSnapshots.forEach((snapshot) => {
        if (
          snapshot.balanceUntilUpdatedAt &&
          parseFloat(snapshot.balanceUntilUpdatedAt) > 0 &&
          !snapshot.token.isNativeAssetSuperToken &&
          !BLACKLISTED_TOKENS.includes(safeToLowerCase(snapshot.token.id))
        ) {
          allTokens.add(snapshot.token.id);
          validSnapshots.push(snapshot);
        }
      });
    }

    const uniqueTokens = Array.from(allTokens);
    if (uniqueTokens.length === 0) {
      setStakes([]);
      setOwnedSuperTokens([]);
      return;
    }

    // PHASE 1: Show basic token list immediately (from subgraph data)
    const stakesData: StakeData[] = [];
    const superTokensData: SuperTokenData[] = [];

    // Build initial data structures with just subgraph data
    validMemberships.forEach((membership) => {
      const tokenAddress = membership.pool.token.id;

      // Calculate user flow rate
      const totalUnits = BigInt(membership.pool.totalUnits || "0");
      const memberUnits = BigInt(membership.units || "0");
      let userFlowRate = 0;

      if (totalUnits > 0n) {
        const percentage = (Number(memberUnits) * 100) / Number(totalUnits);
        const totalFlowRate = Number(
          formatUnits(BigInt(membership.pool.flowRate), 18)
        );
        userFlowRate = totalFlowRate * (percentage / 100) * 86400;
      }

      stakesData.push({
        membership,
        tokenAddress,
        stakingAddress: "", // Will be loaded later
        stakingPoolAddress: membership.pool.id,
        receivedBalance: 0,
        baseAmount: 0,
        lastUpdateTime: Date.now(),
        userFlowRate,
        stakedBalance: BigInt(0),
        logo: undefined,
        marketData: undefined,
        isConnectedToPool: membership.isConnected,
      });
    });

    // Process snapshots for super tokens
    validSnapshots.forEach((snapshot) => {
      const tokenAddress = snapshot.token.id;
      const isAlreadyStaked = stakesData.some(
        (stake) =>
          safeToLowerCase(stake.tokenAddress) === safeToLowerCase(tokenAddress)
      );

      if (!isAlreadyStaked) {
        superTokensData.push({
          tokenAddress,
          symbol: snapshot.token.symbol,
          balance: 0, // Will be loaded later
          stakingAddress: undefined,
          isNativeAssetSuperToken: snapshot.token.isNativeAssetSuperToken,
          logo: undefined,
          marketData: undefined,
          isConnectedToPool: false,
        });
      }
    });

    // Set initial states immediately for fast UI
    setStakes(stakesData);
    setOwnedSuperTokens(superTokensData);

    // Trigger Phase 2 after a brief delay to allow React to render
    setTimeout(() => {
      setLoadingPhase("balances");
    }, 100);
  };

  // Phase 2: Load blockchain balances (critical data)
  const processPhase2 = async () => {
    if (
      !effectiveAddress ||
      (stakes.length === 0 && ownedSuperTokens.length === 0)
    )
      return;

    const uniqueTokens = Array.from(
      new Set([
        ...stakes.map((stake) => stake.tokenAddress),
        ...ownedSuperTokens.map((token) => token.tokenAddress),
      ])
    );

    const balanceResults = new Map();

    // Try to use cached balance data first
    for (const token of uniqueTokens) {
      const cacheKey = `${token}-${effectiveAddress}`;
      const cachedData = balanceData.get(cacheKey);

      if (cachedData) {
        balanceResults.set(`balance-${token}-${effectiveAddress}`, {
          balance: cachedData.tokenBalance,
          timestamp: cachedData.lastUpdated,
        });
      }
    }

    // Fetch any missing balances
    const missingTokens = uniqueTokens.filter(
      (token) => !balanceResults.has(`balance-${token}-${effectiveAddress}`)
    );

    if (missingTokens.length > 0) {
      const additionalResults = await fetchBlockchainDataBatch(
        missingTokens.map((token) => ({
          type: "balance" as const,
          tokenAddress: token,
          userAddress: effectiveAddress,
        }))
      );
      additionalResults.forEach((value, key) => {
        balanceResults.set(key, value);
      });
    }

    // Update states with balance data
    const stakesWithBalances = stakes.map((stake) => {
      const balanceCacheKey = `balance-${stake.tokenAddress}-${effectiveAddress}`;
      const balanceData = balanceResults.get(balanceCacheKey);
      const formattedBalance = balanceData?.balance
        ? Number(formatUnits(balanceData.balance, 18))
        : 0;

      return {
        ...stake,
        receivedBalance: formattedBalance,
        baseAmount: formattedBalance,
      };
    });

    const superTokensWithBalances = ownedSuperTokens.map((token) => {
      const balanceCacheKey = `balance-${token.tokenAddress}-${effectiveAddress}`;
      const balanceData = balanceResults.get(balanceCacheKey);
      const formattedBalance = balanceData?.balance
        ? Number(formatUnits(balanceData.balance, 18))
        : 0;

      return {
        ...token,
        balance: formattedBalance,
      };
    });

    // Load staking data for stakes
    const finalStakesData = await loadStakingDataSync(stakesWithBalances);

    setStakes(finalStakesData);
    setOwnedSuperTokens(superTokensWithBalances);

    // Trigger Phase 3 after a brief delay
    setTimeout(() => {
      setLoadingPhase("metadata");
    }, 300);
  };

  // Phase 3: Load metadata (logos, market data) and liquidity data - non-critical
  const processPhase3 = async () => {
    if (
      !effectiveAddress ||
      (stakes.length === 0 && ownedSuperTokens.length === 0)
    )
      return;

    const uniqueTokens = Array.from(
      new Set([
        ...stakes.map((stake) => stake.tokenAddress),
        ...ownedSuperTokens.map((token) => token.tokenAddress),
      ])
    );

    const tokenDataMap = await fetchTokenDataBatch(uniqueTokens);

    // Check liquidity for all tokens
    await checkLiquidityBatch(uniqueTokens);

    // Update states with metadata
    const stakesWithMetadata = stakes
      .map((stake) => {
        const tokenData = tokenDataMap.get(stake.tokenAddress) as CachedTokenDataItem | undefined;
        return {
          ...stake,
          stakingAddress: tokenData?.staking_address || "",
          logo: tokenData?.logo,
          marketData: tokenData?.marketData,
          lockDuration: tokenData?.staking?.lockDuration, // Extract lock duration from staking config
        };
      })
      // Filter to only include stakes where the membership pool matches the official staking pool from database
      .filter((stake) => {
        const tokenData = tokenDataMap.get(stake.tokenAddress) as CachedTokenDataItem | undefined;
        const officialStakingPool = tokenData?.staking_pool
          ? safeToLowerCase(tokenData.staking_pool)
          : null;
        const membershipPoolId = safeToLowerCase(stake.stakingPoolAddress);

        // Keep stake only if:
        // 1. There's an official staking pool AND it matches the membership pool
        // 2. OR there's no official staking pool (token not in database)
        if (officialStakingPool && membershipPoolId !== officialStakingPool) {
          console.log(
            `Filtering out stake for ${stake.membership?.pool?.token?.symbol}: membership pool ${membershipPoolId} does not match official staking pool ${officialStakingPool}`
          );
          return false;
        }
        return true;
      });

    const superTokensWithMetadata = ownedSuperTokens.map((token) => ({
      ...token,
      stakingAddress: tokenDataMap.get(token.tokenAddress)?.staking_address,
      logo: tokenDataMap.get(token.tokenAddress)?.logo,
      marketData: tokenDataMap.get(token.tokenAddress)?.marketData,
    }));

    setStakes(stakesWithMetadata);
    setOwnedSuperTokens(superTokensWithMetadata);
    setLoadingPhase("complete");

    // Register active tokens for automatic refresh
    stakesWithMetadata.forEach((stake) => {
      registerActiveToken(stake.tokenAddress);
    });
    superTokensWithMetadata.forEach((token) => {
      registerActiveToken(token.tokenAddress);
    });
  };

  // Load staking data synchronously and return updated stakes
  const loadStakingDataSync = async (
    stakesData: StakeData[]
  ): Promise<StakeData[]> => {
    const stakesWithStaking = stakesData.filter(
      (stake) => stake.stakingAddress && stake.stakingAddress !== ""
    );

    if (stakesWithStaking.length === 0) return stakesData;

    try {
      // Load staked balances for all stakes with staking addresses
      const stakedBalancePromises = stakesWithStaking.map(async (stake) => {
        try {
          const stakedBalance = await publicClient.readContract({
            address: stake.stakingAddress as `0x${string}`,
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
          });
          return {
            tokenAddress: stake.tokenAddress,
            stakedBalance: stakedBalance as bigint,
          };
        } catch (error) {
          console.warn(
            `Failed to fetch staked balance for ${stake.membership.pool.token.symbol}:`,
            error
          );
          return { tokenAddress: stake.tokenAddress, stakedBalance: BigInt(0) };
        }
      });

      // Load pool connection status for all stakes
      const poolConnectionPromises = stakesWithStaking.map(async (stake) => {
        try {
          const isConnected = await publicClient.readContract({
            address: GDA_FORWARDER,
            abi: GDA_ABI,
            functionName: "isMemberConnected",
            args: [
              stake.stakingPoolAddress as `0x${string}`,
              effectiveAddress as `0x${string}`,
            ],
          });
          return {
            tokenAddress: stake.tokenAddress,
            isConnected: isConnected as boolean,
          };
        } catch (error) {
          console.warn(
            `Failed to fetch pool connection for ${stake.membership.pool.token.symbol}:`,
            error
          );
          return {
            tokenAddress: stake.tokenAddress,
            isConnected: stake.isConnectedToPool,
          };
        }
      });

      const [stakedBalanceResults, poolConnectionResults] = await Promise.all([
        Promise.all(stakedBalancePromises),
        Promise.all(poolConnectionPromises),
      ]);

      // Create maps for quick lookup
      const stakedBalanceMap = new Map(
        stakedBalanceResults.map((result) => [
          result.tokenAddress,
          result.stakedBalance,
        ])
      );
      const poolConnectionMap = new Map(
        poolConnectionResults.map((result) => [
          result.tokenAddress,
          result.isConnected,
        ])
      );

      // Update stakes with the loaded data and return the updated array
      const updatedStakes = stakesData.map((stake) => {
        if (!stake.stakingAddress || stake.stakingAddress === "") {
          return stake;
        }

        const stakedBalance =
          stakedBalanceMap.get(stake.tokenAddress) || BigInt(0);
        const isConnected =
          poolConnectionMap.get(stake.tokenAddress) ?? stake.isConnectedToPool;

        return {
          ...stake,
          stakedBalance,
          isConnectedToPool: isConnected,
        };
      });

      return updatedStakes;
    } catch (error) {
      console.error("Error loading staking data:", error);
      return stakesData; // Return original data on error
    }
  };

  const calculateSharePercentage = (units: string, totalUnits: string) => {
    if (!units || !totalUnits || totalUnits === "0") return "0";
    const percentage = (parseFloat(units) / parseFloat(totalUnits)) * 100;
    return percentage.toFixed(2);
  };

  // Helper function to render 24h change
  const render24hChange = (change24h: number | undefined) => {
    const { formatted, isPositive } = format24hChange(change24h);
    if (isPositive === null) return formatted;

    return (
      <span className={isPositive ? "text-green-500" : "text-red-500"}>
        {formatted}
      </span>
    );
  };

  // Helper function to calculate total USD value for a stake
  const calculateStakeUSDValue = (stake: StakeData): number => {
    const price = stake.marketData?.price || 0;
    const stakedBalance = Number(formatUnits(stake.stakedBalance || 0n, 18));
    const currentBalance = stake.baseAmount || 0;
    return (stakedBalance + currentBalance) * price;
  };

  // Helper function to calculate USD value for a super token
  const calculateTokenUSDValue = (token: SuperTokenData): number => {
    const price = token.marketData?.price || 0;
    return token.balance * price;
  };

  // Function to check liquidity for multiple tokens
  const checkLiquidityBatch = async (tokenAddresses: string[]) => {
    const newLiquidityCache = new Map(liquidityCache);

    // Check liquidity for each token that's not already cached
    const uncachedTokens = tokenAddresses.filter(
      (addr) => !newLiquidityCache.has(addr.toLowerCase())
    );

    console.log("Checking liquidity for tokens:", uncachedTokens);

    if (uncachedTokens.length === 0) {
      console.log("All tokens already cached");
      return;
    }

    try {
      // Use the batch endpoint for efficiency
      const batches = [];
      for (let i = 0; i < uncachedTokens.length; i += 30) {
        batches.push(uncachedTokens.slice(i, i + 30));
      }

      for (const batch of batches) {
        try {
          const response = await fetch("/api/tokens/multiple?type=all", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tokenAddresses: batch }),
          });

          if (response.ok) {
            const result = await response.json();

            batch.forEach((tokenAddress, index) => {
              const tokenData = result.tokens[index];

              console.log(`Token data for ${tokenAddress}:`, tokenData);

              if (tokenData?.marketData) {
                const marketCap = tokenData.marketData.marketCap || 0;
                // Try different date fields that might exist
                const launchTime =
                  tokenData.created_at || tokenData.timestamp?.seconds
                    ? new Date(tokenData.timestamp.seconds * 1000)
                    : tokenData.timestamp?._seconds
                    ? new Date(tokenData.timestamp._seconds * 1000)
                    : new Date();
                const hoursSinceLaunch =
                  (Date.now() - new Date(launchTime).getTime()) /
                  (1000 * 60 * 60);

                // Consider low liquidity if:
                // 1. Market cap is very low (< $5000) AND token is older than 1 hour
                // 2. Or market cap is extremely low (< $1000) regardless of age
                const isLowLiquidity =
                  (marketCap < 5000 && hoursSinceLaunch > 1) ||
                  marketCap < 1000;

                console.log(
                  `Token ${tokenAddress}: marketCap=${marketCap}, hoursSinceLaunch=${hoursSinceLaunch}, isLowLiquidity=${isLowLiquidity}`
                );

                newLiquidityCache.set(
                  tokenAddress.toLowerCase(),
                  isLowLiquidity
                );
              } else {
                console.log(
                  `No market data for ${tokenAddress}, assuming normal liquidity`
                );
                // If no market data, assume normal liquidity
                newLiquidityCache.set(tokenAddress.toLowerCase(), false);
              }
            });
          } else {
            console.warn(`Batch API call failed: ${response.status}`);
            // Default all tokens in batch to normal liquidity on error
            batch.forEach((tokenAddress) => {
              newLiquidityCache.set(tokenAddress.toLowerCase(), false);
            });
          }
        } catch (error) {
          console.warn(`Failed to check liquidity for batch:`, error);
          // Default all tokens in batch to normal liquidity on error
          batch.forEach((tokenAddress) => {
            newLiquidityCache.set(tokenAddress.toLowerCase(), false);
          });
        }
      }

      console.log(
        "Updated liquidity cache:",
        Array.from(newLiquidityCache.entries())
      );
      setLiquidityCache(newLiquidityCache);
    } catch (error) {
      console.warn("Batch liquidity check failed:", error);
    }
  };

  // Helper function to determine if a stake has low liquidity
  const isStakeLowLiquidity = (stake: StakeData): boolean => {
    const tokenAddress = stake.tokenAddress.toLowerCase();
    return liquidityCache.get(tokenAddress) || false;
  };

  // Helper function to determine if a token has low liquidity
  const isTokenLowLiquidity = (token: SuperTokenData): boolean => {
    const tokenAddress = token.tokenAddress.toLowerCase();
    return liquidityCache.get(tokenAddress) || false;
  };

  // Targeted update functions

  const updateStakedBalance = async (
    stakingAddress: string,
    tokenAddress: string
  ) => {
    if (!effectiveAddress) return;

    try {
      const results = await fetchBlockchainDataBatch([
        {
          type: "stakedBalance" as const,
          stakingAddress: stakingAddress,
          userAddress: effectiveAddress,
          tokenAddress: tokenAddress,
        },
      ]);

      const cacheKey = `stakedBalance-${stakingAddress}-${effectiveAddress}`;
      const stakedBalanceResult = results.get(cacheKey);

      setStakes((prevStakes) =>
        prevStakes.map((stake) => {
          if (stake.tokenAddress === tokenAddress) {
            return {
              ...stake,
              stakedBalance:
                (stakedBalanceResult?.stakedBalance as bigint) || BigInt(0),
            };
          }
          return stake;
        })
      );
    } catch (error) {
      console.error("Error updating staked balance:", error);
    }
  };

  const updatePoolConnectionStatus = async (
    poolAddress: string,
    tokenAddress: string
  ) => {
    if (!effectiveAddress) return;

    try {
      const results = await fetchBlockchainDataBatch([
        {
          type: "poolConnection" as const,
          poolAddress: poolAddress,
          userAddress: effectiveAddress,
          tokenAddress: tokenAddress,
        },
      ]);

      const cacheKey = `poolConnection-${poolAddress}-${effectiveAddress}`;
      const connectionResult = results.get(cacheKey);

      setStakes((prevStakes) =>
        prevStakes.map((stake) => {
          if (stake.tokenAddress === tokenAddress) {
            return {
              ...stake,
              isConnectedToPool:
                (connectionResult?.poolConnection as boolean) ?? false,
            };
          }
          return stake;
        })
      );
    } catch (error) {
      console.error("Error updating pool connection status:", error);
    }
  };

  const handleStakeSuccess = async (
    tokenAddress?: string,
    stakingAddress?: string
  ) => {
    if (tokenAddress) {
      // Use centralized refresh for the specific token
      await refreshTokenData(tokenAddress, stakingAddress);

      // Also update staked balance if staking address is provided
      if (stakingAddress) {
        updateStakedBalance(stakingAddress, tokenAddress);
      }
    } else {
      // For bulk operations (like top-up all), just trigger a small delay then refresh
      // This prevents race conditions with ongoing state updates
      setTimeout(async () => {
        await refreshAllData();
      }, 500);
    }

    // Refresh staked balances to update unstake timers
    setTimeout(() => {
      refreshStakedBalances();
    }, 1000);
  };

  const handleConnectPoolSuccess = async (
    poolAddress: string,
    tokenAddress: string
  ) => {
    // Refresh token data and update pool connection status
    await refreshTokenData(tokenAddress);
    updatePoolConnectionStatus(poolAddress, tokenAddress);
  };

  const handleSuperTokenStakeSuccess = async (tokenAddress: string) => {
    // Refresh token data which will update balances
    await refreshTokenData(tokenAddress);

    // Also refresh stake data to see if new stake was created
    // Use a short delay to ensure the blockchain state is updated
    setTimeout(() => {
      fetchStakesAndTokens();
    }, 2000);
  };

  // Manual refresh function for users to force enhancement
  const handleManualRefresh = async () => {
    if (refreshing || !effectiveAddress) return;

    setRefreshing(true);
    try {
      // Refresh all centralized data first
      await refreshAllData();
      // Then re-fetch stakes and tokens to update UI
      await fetchStakesAndTokens();
    } catch (error) {
      console.error("Manual refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">My Tokens</h2>
          <div className="flex items-center gap-2">
            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="btn btn-ghost btn-sm btn-circle"
              title="Refresh token data"
            >
              {refreshing ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {(stakes.length > 0 || ownedSuperTokens.length > 0) && (
          <div className="mb-4">
            <div className="form-control mb-4">
              <input
                type="text"
                placeholder="Search tokens by symbol..."
                className="input input-bordered w-full text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <TopUpAllStakesButton
              stakes={stakes}
              ownedSuperTokens={ownedSuperTokens}
              onSuccess={() => handleStakeSuccess()}
              className="btn btn-tertiary btn-sm w-full"
              isMiniApp={isMiniAppView}
              farcasterAddress={effectiveAddress}
              farcasterIsConnected={effectiveIsConnected}
            />
          </div>
        )}

        <div className="space-y-4">
          {!effectiveAddress ? (
            <div className="text-center py-8">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-base-content/30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Wallet Connection Required
              </h3>
              <p className="text-base-content/70 mb-4">
                Please connect your wallet to view your stakes and SuperTokens.
              </p>
              {!isMiniAppView && (
                <button onClick={onClose} className="btn btn-primary btn-sm">
                  Connect Wallet
                </button>
              )}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {/* Skeleton loading */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="card bg-base-100 border border-base-300 animate-pulse"
                >
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-base-300"></div>
                        <div>
                          <div className="h-5 bg-base-300 rounded w-20 mb-1"></div>
                          <div className="h-3 bg-base-300 rounded w-16"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-base-300 rounded w-16"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-base-300 rounded w-full"></div>
                      <div className="h-4 bg-base-300 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="alert alert-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
              <button
                onClick={fetchStakesAndTokens}
                className="btn btn-primary btn-sm mt-4"
              >
                Retry
              </button>
            </div>
          ) : stakes.length === 0 && ownedSuperTokens.length === 0 ? (
            <div className="text-center py-8">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-base-content/30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              {accountExists === false ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">
                    Welcome to Streme!
                  </h3>
                  <p className="text-base-content/70 mb-4">
                    You haven&apos;t interacted with any tokens yet. Start by
                    exploring and staking in your favorite tokens!
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <button
                      onClick={onClose}
                      className="btn btn-primary btn-sm"
                    >
                      Explore Tokens
                    </button>
                    <a
                      href="https://docs.superfluid.org/docs/sdk/distributions/subgraph"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      Learn More
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">
                    No Stakes or SuperTokens Found
                  </h3>
                  <p className="text-base-content/70 mb-4">
                    You don&apos;t have any active stakes or SuperTokens yet.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <button
                      onClick={onClose}
                      className="btn btn-primary btn-sm"
                    >
                      Explore Tokens
                    </button>
                    <a
                      href="https://docs.superfluid.org/docs/sdk/distributions/subgraph"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      Learn About Superfluid
                    </a>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Your Tokens</h3>
                <span className="badge badge-primary">
                  {stakes.length + ownedSuperTokens.length} tokens
                </span>
              </div> */}

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {/* Staked Tokens */}
                {stakes
                  .filter((stake) => {
                    if (!searchTerm.trim()) return true;
                    const searchLower = searchTerm.toLowerCase();
                    return (
                      stake.membership.pool.token.symbol
                        ?.toLowerCase()
                        .includes(searchLower) ?? false
                    );
                  })
                  .reduce((acc, stake) => {
                    // Deduplicate by token address - keep the highest stake if multiple pools exist
                    const existing = acc.find(
                      (s) =>
                        s.tokenAddress.toLowerCase() ===
                        stake.tokenAddress.toLowerCase()
                    );
                    if (
                      !existing ||
                      calculateStakeUSDValue(stake) >
                        calculateStakeUSDValue(existing)
                    ) {
                      return [
                        ...acc.filter(
                          (s) =>
                            s.tokenAddress.toLowerCase() !==
                            stake.tokenAddress.toLowerCase()
                        ),
                        stake,
                      ];
                    }
                    return acc;
                  }, [] as StakeData[])
                  .sort((a, b) => {
                    // First sort by liquidity status (normal liquidity tokens first)
                    const aIsLowLiquidity = isStakeLowLiquidity(a);
                    const bIsLowLiquidity = isStakeLowLiquidity(b);

                    if (aIsLowLiquidity !== bIsLowLiquidity) {
                      return aIsLowLiquidity ? 1 : -1; // Normal liquidity first
                    }

                    // Within the same liquidity group, sort by total USD value in descending order
                    const aUSDValue = calculateStakeUSDValue(a);
                    const bUSDValue = calculateStakeUSDValue(b);
                    return bUSDValue - aUSDValue;
                  })
                  .map((stake, index) => (
                    <div
                      key={`stake-${stake.tokenAddress}-${index}`}
                      className="card bg-base-100 border border-base-300"
                    >
                      <div className="card-body p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            {/* Token Logo */}
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-base-200 flex items-center justify-center">
                              {loadingPhase !== "complete" && !stake.logo ? (
                                <div className="w-full h-full bg-base-300 animate-pulse" />
                              ) : stake.logo ? (
                                <img
                                  src={stake.logo}
                                  alt={stake.membership.pool.token.symbol}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    target.nextElementSibling!.classList.remove(
                                      "hidden"
                                    );
                                  }}
                                />
                              ) : null}
                              <div
                                className={`${
                                  stake.logo ||
                                  (loadingPhase !== "complete" && !stake.logo)
                                    ? "hidden"
                                    : ""
                                } w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold`}
                              >
                                {stake.membership.pool.token.symbol.charAt(0)}
                              </div>
                            </div>
                            <div>
                              <a
                                href={`/token/${stake.tokenAddress}`}
                                className="hover:text-primary transition-colors"
                              >
                                <h4 className="font-semibold text-lg">
                                  {stake.membership.pool.token.symbol}
                                  {stake.membership.pool.token
                                    .isNativeAssetSuperToken && (
                                    <span className="badge badge-secondary badge-sm ml-2">
                                      Native
                                    </span>
                                  )}
                                </h4>
                              </a>
                            </div>
                          </div>
                          <div className="flex flex-col items-start">
                            <div className="text-right text-xs uppercase tracking-wider opacity-50">
                              MCAP
                            </div>
                            {loadingPhase !== "complete" ? (
                              <div className="flex gap-2 items-baseline">
                                <div className="h-4 w-16 bg-base-300 rounded animate-pulse" />
                                <div className="h-3 w-12 bg-base-300 rounded animate-pulse" />
                              </div>
                            ) : (
                              <div className="flex gap-2 items-baseline">
                                <div className="font-mono text-sm font-bold">
                                  {formatMarketCap(stake.marketData?.marketCap)}
                                </div>
                                <div className="text-xs mt-1">
                                  {render24hChange(
                                    stake.marketData?.priceChange24h
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-4 text-sm mb-4">
                          <div>
                            <p className="text-base-content/70">
                              Staked Amount
                            </p>
                            <p className="font-mono">
                              {parseFloat(
                                stake.membership.units
                              ).toLocaleString()}{" "}
                              st{stake.membership.pool.token.symbol} (
                              {calculateSharePercentage(
                                stake.membership.units,
                                stake.membership.pool.totalUnits
                              )}
                              %)
                            </p>
                          </div>

                          {/* Show Current Balance if connected, or Pool Connection Status if not connected */}
                          {stake.isConnectedToPool ? (
                            <CurrentBalanceDisplay
                              stake={stake}
                              isMiniApp={isMiniAppView}
                            />
                          ) : stake.stakingAddress &&
                            stake.stakingAddress !== "" &&
                            stake.isConnectedToPool === false ? (
                            <div className="bg-base-200 rounded-lg p-3 border border-base-300">
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                <span className="text-sm font-medium text-base-content">
                                  Not connected to reward pool
                                </span>
                              </div>
                              {stake.stakedBalance > 0n && (
                                <p className="text-xs text-base-content/70 mb-3 text-center">
                                  Connect to start receiving rewards on your
                                  staked tokens
                                </p>
                              )}
                              {/* Show ConnectPoolButton if not connected and has staked balance */}
                              {stake.stakedBalance > 0n &&
                                stake.stakingPoolAddress && (
                                  <ConnectPoolButton
                                    stakingPoolAddress={
                                      stake.stakingPoolAddress as `0x${string}`
                                    }
                                    onSuccess={() =>
                                      handleConnectPoolSuccess(
                                        stake.stakingPoolAddress,
                                        stake.tokenAddress
                                      )
                                    }
                                    isMiniApp={isMiniAppView}
                                    farcasterAddress={effectiveAddress}
                                    farcasterIsConnected={effectiveIsConnected}
                                  />
                                )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-base-content/70">
                                Current Balance
                              </p>
                              <div className="flex items-center">
                                <p className="font-mono text-success">
                                  {stake.baseAmount.toLocaleString("en-US", {
                                    minimumFractionDigits: 6,
                                    maximumFractionDigits: 6,
                                  })}
                                  <span className="ml-1">
                                    {stake.membership.pool.token.symbol}
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action buttons - show if we have a valid staking address */}
                        {loadingPhase !== "complete" &&
                        stake.stakingAddress === "" ? (
                          <div className="pt-3">
                            <div className="btn btn-disabled btn-sm w-full">
                              <span className="loading loading-spinner loading-xs"></span>
                              Loading staking info...
                            </div>
                          </div>
                        ) : stake.stakingAddress &&
                          stake.stakingAddress !==
                            "0x0000000000000000000000000000000000000000" ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <StakeButton
                                tokenAddress={stake.tokenAddress}
                                stakingAddress={stake.stakingAddress}
                                stakingPoolAddress={stake.stakingPoolAddress}
                                symbol={stake.membership.pool.token.symbol}
                                tokenBalance={BigInt(
                                  Math.round(stake.baseAmount * 1e18)
                                )}
                                onSuccess={() =>
                                  handleStakeSuccess(
                                    stake.tokenAddress,
                                    stake.stakingAddress
                                  )
                                }
                                className="btn btn-primary btn-sm"
                              />
                              <StakeAllButton
                                tokenAddress={stake.tokenAddress}
                                stakingPoolAddress={stake.stakingPoolAddress}
                                symbol={stake.membership.pool.token.symbol}
                                tokenBalance={BigInt(
                                  Math.round(stake.baseAmount * 1e18)
                                )}
                                onSuccess={() =>
                                  handleStakeSuccess(
                                    stake.tokenAddress,
                                    stake.stakingAddress
                                  )
                                }
                                isMiniApp={isMiniAppView}
                                farcasterAddress={effectiveAddress}
                                farcasterIsConnected={effectiveIsConnected}
                                className="btn btn-secondary btn-sm"
                              />
                            </div>
                            <UnstakeButton
                              stakingAddress={stake.stakingAddress}
                              userStakedBalance={stake.stakedBalance}
                              symbol={stake.membership.pool.token.symbol}
                              lockDuration={stake.lockDuration}
                              onSuccess={() =>
                                handleStakeSuccess(
                                  stake.tokenAddress,
                                  stake.stakingAddress
                                )
                              }
                              disabled={
                                stake.stakedBalance === 0n ||
                                !stake.stakingAddress
                              }
                              className="btn btn-outline btn-sm w-full"
                            />
                          </div>
                        ) : stake.stakingAddress === "" ? (
                          <div className="pt-3">
                            <div className="btn btn-disabled btn-sm w-full">
                              <span className="loading loading-spinner loading-xs"></span>
                              Loading staking info...
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}

                {/* Separator line if both staked and owned tokens exist */}
                {stakes.length > 0 && ownedSuperTokens.length > 0 && (
                  <div className="divider">Available to Stake</div>
                )}

                {/* Owned SuperTokens (not staked) */}
                {ownedSuperTokens
                  .filter((token) => {
                    if (!searchTerm.trim()) return true;
                    const searchLower = searchTerm.toLowerCase();
                    return (
                      token.symbol?.toLowerCase().includes(searchLower) ?? false
                    );
                  })
                  .reduce((acc, token) => {
                    // Deduplicate by token address - keep the one with highest balance if duplicates exist
                    const existing = acc.find(
                      (t) =>
                        t.tokenAddress.toLowerCase() ===
                        token.tokenAddress.toLowerCase()
                    );
                    if (!existing || token.balance > existing.balance) {
                      return [
                        ...acc.filter(
                          (t) =>
                            t.tokenAddress.toLowerCase() !==
                            token.tokenAddress.toLowerCase()
                        ),
                        token,
                      ];
                    }
                    return acc;
                  }, [] as SuperTokenData[])
                  .sort((a, b) => {
                    // First sort by liquidity status (normal liquidity tokens first)
                    const aIsLowLiquidity = isTokenLowLiquidity(a);
                    const bIsLowLiquidity = isTokenLowLiquidity(b);

                    if (aIsLowLiquidity !== bIsLowLiquidity) {
                      return aIsLowLiquidity ? 1 : -1; // Normal liquidity first
                    }

                    // Within the same liquidity group, sort by USD value in descending order
                    const aUSDValue = calculateTokenUSDValue(a);
                    const bUSDValue = calculateTokenUSDValue(b);
                    return bUSDValue - aUSDValue;
                  })
                  .map((token, index) => (
                    <div
                      key={`supertoken-${token.tokenAddress}-${index}`}
                      className="card bg-base-100 border border-base-300"
                    >
                      <div className="card-body p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            {/* Token Logo */}
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-base-200 flex items-center justify-center">
                              {loadingPhase !== "complete" ? (
                                <div className="w-full h-full bg-base-300 rounded-full animate-pulse" />
                              ) : token.logo ? (
                                <img
                                  src={token.logo}
                                  alt={token.symbol}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    target.nextElementSibling!.classList.remove(
                                      "hidden"
                                    );
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                  {token.symbol.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <a
                                href={`/token/${token.tokenAddress}`}
                                className="hover:text-blue-600 transition-colors"
                              >
                                <h4 className="font-semibold text-lg">
                                  {token.symbol}
                                  {token.isNativeAssetSuperToken && (
                                    <span className="badge badge-secondary badge-sm ml-2">
                                      Native
                                    </span>
                                  )}
                                </h4>
                              </a>
                            </div>
                          </div>
                          <div className="flex flex-col items-end text-right">
                            <div className="flex flex-col items-baseline">
                              <div className="text-right text-xs uppercase tracking-wider opacity-50">
                                MCAP
                              </div>
                              {loadingPhase !== "complete" ? (
                                <div className="flex gap-2 items-baseline">
                                  <div className="h-4 w-16 bg-base-300 rounded animate-pulse" />
                                  <div className="h-3 w-12 bg-base-300 rounded animate-pulse" />
                                </div>
                              ) : (
                                <div className="flex gap-2 items-baseline">
                                  <div className="font-mono text-sm font-bold">
                                    {formatMarketCap(
                                      token.marketData?.marketCap
                                    )}
                                  </div>
                                  <div className="text-xs mt-1">
                                    {render24hChange(
                                      token.marketData?.priceChange24h
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4 text-sm mb-4">
                          <div>
                            <p className="text-base-content/70">Balance</p>
                            <p className="font-mono text-primary">
                              {token.balance.toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                              <span className="ml-1">{token.symbol}</span>
                            </p>
                          </div>
                        </div>

                        {/* Action buttons - show if we have a valid staking address */}
                        {token.stakingAddress ? (
                          <div className="pt-3">
                            <div className="grid grid-cols-2 gap-2">
                              <StakeButton
                                tokenAddress={token.tokenAddress}
                                stakingAddress={token.stakingAddress}
                                stakingPoolAddress="" // Not needed for unstaked tokens
                                symbol={token.symbol}
                                tokenBalance={BigInt(
                                  Math.round(token.balance * 1e18)
                                )}
                                onSuccess={() =>
                                  handleSuperTokenStakeSuccess(
                                    token.tokenAddress
                                  )
                                }
                                className="btn btn-primary btn-sm"
                              />
                              <StakeAllButton
                                tokenAddress={token.tokenAddress}
                                stakingPoolAddress="" // Not needed for unstaked tokens
                                symbol={token.symbol}
                                tokenBalance={BigInt(
                                  Math.round(token.balance * 1e18)
                                )}
                                onSuccess={() =>
                                  handleSuperTokenStakeSuccess(
                                    token.tokenAddress
                                  )
                                }
                                isMiniApp={isMiniAppView}
                                farcasterAddress={effectiveAddress}
                                farcasterIsConnected={effectiveIsConnected}
                                className="btn btn-secondary btn-sm"
                              />
                            </div>
                          </div>
                        ) : token.stakingAddress === undefined ? (
                          <div className="pt-3">
                            <div className="btn btn-disabled btn-sm w-full">
                              <span className="loading loading-spinner loading-xs"></span>
                              Loading staking info...
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
              </div>

              {/* <div className="text-center pt-4 border-t">
                <a
                  href={`https://explorer.superfluid.finance/base-mainnet/accounts/${effectiveAddress}?tab=pools`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  View on Superfluid Explorer
                </a>
              </div> */}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
