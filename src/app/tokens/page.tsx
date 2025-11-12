"use client";

import { useState, useEffect } from "react";
import { useAppFrameLogic } from "../../hooks/useAppFrameLogic";
import { useWallet } from "../../hooks/useWallet";
import { formatUnits } from "viem";
import { StakeButton } from "../../components/StakeButton";
import { UnstakeButton } from "../../components/UnstakeButton";
import { ConnectPoolButton } from "../../components/ConnectPoolButton";
import { TopUpAllStakesButton } from "../../components/TopUpAllStakesButton";
import { HeroAnimationMini } from "../../components/HeroAnimationMini";
import { publicClient } from "../../lib/viemClient";
import { GDA_FORWARDER, GDA_ABI } from "../../lib/contracts";
import Link from "next/link";
// import { UnstakedTokensModal } from "../../components/UnstakedTokensModal";
import { useTokenData } from "../../hooks/useTokenData";
import { BLACKLISTED_TOKENS } from "../../lib/blacklist";

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
  streamedAmount: number;
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

// Cache for token data to avoid repeated API calls
interface CachedTokenData {
  staking_address?: string;
  staking_pool?: string;
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

const tokenDataCache = new Map<string, CachedTokenData>();

export default function TokensPage() {
  const { address: effectiveAddress } = useWallet();
  const { isMiniAppView } = useAppFrameLogic();

  const [stakes, setStakes] = useState<StakeData[]>([]);
  const [ownedSuperTokens, setOwnedSuperTokens] = useState<SuperTokenData[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  // const [showUnstakedModal, setShowUnstakedModal] = useState(true);

  // Use centralized token data hook
  const {
    balanceData,
    refreshTokenData,
    refreshAllData,
    registerActiveToken,
    unregisterActiveToken,
  } = useTokenData();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);

    // Add global error handler for uncaught toLowerCase errors
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes("toLowerCase")) {
        console.warn("Caught toLowerCase error:", event.error);
        event.preventDefault();
        return true;
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes("toLowerCase")) {
        console.warn("Caught toLowerCase promise rejection:", event.reason);
        event.preventDefault();
        return true;
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // Helper function to safely call toLowerCase on potentially null values
  const safeToLowerCase = (value: string | null | undefined): string => {
    if (!value || typeof value !== "string") {
      return "";
    }
    return value.toLowerCase();
  };

  // Helper function to fetch token data with caching (kept for backward compatibility)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchTokenData = async (tokenAddress: string) => {
    // Don't make API calls for blacklisted tokens
    if (
      !tokenAddress ||
      BLACKLISTED_TOKENS.includes(safeToLowerCase(tokenAddress))
    ) {
      const fallbackData = {
        staking_address: undefined,
        logo: undefined,
        marketData: undefined,
      };
      return fallbackData;
    }

    if (tokenDataCache.has(tokenAddress)) {
      return tokenDataCache.get(tokenAddress)!;
    }

    try {
      const response = await fetch(
        `/api/tokens/single?address=${tokenAddress}&type=all`
      );
      if (response.ok) {
        const result = await response.json();
        const tokenData = {
          staking_address: result.data?.staking_address,
          staking_pool: result.data?.staking_pool,
          logo: result.data?.img_url || result.data?.logo || result.data?.image,
          marketData: result.data?.marketData,
        };
        tokenDataCache.set(tokenAddress, tokenData);
        return tokenData;
      } else {
        console.warn(
          `API returned ${response.status} for token ${tokenAddress}`
        );
      }
    } catch (error) {
      console.warn("Could not fetch token data for:", tokenAddress, error);
    }

    const fallbackData = {
      staking_address: undefined,
      staking_pool: undefined,
      logo: undefined,
      marketData: undefined,
    };
    tokenDataCache.set(tokenAddress, fallbackData);
    return fallbackData;
  };

  // Batch fetch token data for multiple addresses
  const fetchTokenDataBatch = async (tokenAddresses: string[]) => {
    const results = new Map();
    const toFetch: string[] = [];

    // Check cache and filter out blacklisted tokens
    tokenAddresses.forEach((address) => {
      if (BLACKLISTED_TOKENS.includes(safeToLowerCase(address))) {
        results.set(address, {
          staking_address: undefined,
          staking_pool: undefined,
          logo: undefined,
          marketData: undefined,
        });
        return;
      }

      const cached = tokenDataCache.get(address);
      if (cached) {
        results.set(address, cached);
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
              };

              // Cache the result
              tokenDataCache.set(address, processedData);
              results.set(address, processedData);
            } else {
              // Token not found in database
              const fallbackData = {
                staking_address: undefined,
                staking_pool: undefined,
                logo: undefined,
                marketData: undefined,
              };
              tokenDataCache.set(address, fallbackData);
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

  // Helper function to batch balance calls using centralized data with fallback
  const fetchBalances = async (tokenAddresses: string[]) => {
    const results = [];
    const tokensNeedingDirectFetch = [];

    // First, try to get cached data
    for (const tokenAddress of tokenAddresses) {
      const cacheKey = `${tokenAddress}-${effectiveAddress}`;
      const cachedData = balanceData.get(cacheKey);

      if (cachedData) {
        results.push({ tokenAddress, balance: cachedData.tokenBalance });
      } else {
        tokensNeedingDirectFetch.push(tokenAddress);
      }
    }

    // For tokens not in cache, fetch directly from blockchain
    if (tokensNeedingDirectFetch.length > 0) {
      const directFetchPromises = tokensNeedingDirectFetch.map(
        async (tokenAddress) => {
          try {
            const balance = await publicClient.readContract({
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
            });

            // Also trigger background refresh for future use
            refreshTokenData(tokenAddress).catch(console.warn);

            return { tokenAddress, balance };
          } catch (error) {
            console.warn("Failed to fetch balance for:", tokenAddress, error);
            return { tokenAddress, balance: BigInt(0) };
          }
        }
      );

      const directResults = await Promise.all(directFetchPromises);
      results.push(...directResults);
    }

    return results;
  };

  // Helper function to check pool connection status
  const checkPoolConnection = async (
    poolAddress: string,
    userAddress: string
  ): Promise<boolean> => {
    try {
      const connectedStatus = await publicClient.readContract({
        address: GDA_FORWARDER,
        abi: GDA_ABI,
        functionName: "isMemberConnected",
        args: [poolAddress as `0x${string}`, userAddress as `0x${string}`],
      });
      return connectedStatus as boolean;
    } catch (error) {
      console.error("Error checking pool connection:", error);
      return false;
    }
  };

  useEffect(() => {
    if (effectiveAddress) {
      fetchStakesAndTokens();
    }
  }, [effectiveAddress]);

  // Create stable token lists for dependencies
  const stakeTokenAddresses = stakes
    .map((s) => s.tokenAddress)
    .sort()
    .join(",");
  const superTokenAddresses = ownedSuperTokens
    .map((t) => t.tokenAddress)
    .sort()
    .join(",");

  // Register active tokens for automatic refresh
  useEffect(() => {
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
  }, [
    stakeTokenAddresses,
    superTokenAddresses,
    registerActiveToken,
    unregisterActiveToken,
  ]);

  // Update balances when centralized data changes
  useEffect(() => {
    if (!effectiveAddress || loading) return;

    // Update stakes if we have any
    if (stakes.length > 0) {
      setStakes((prevStakes) => {
        const updatedStakes = prevStakes.map((stake) => {
          const cacheKey = `${stake.tokenAddress}-${effectiveAddress}`;
          const cachedData = balanceData.get(cacheKey);

          if (cachedData && stake.stakingAddress) {
            // Only update if stake is fully loaded
            const formattedBalance = Number(
              formatUnits(cachedData.tokenBalance, 18)
            );
            if (Math.abs(formattedBalance - stake.baseAmount) > 0.0001) {
              return {
                ...stake,
                receivedBalance: formattedBalance,
                baseAmount: formattedBalance,
                lastUpdateTime: cachedData.lastUpdated,
              };
            }
          }
          return stake;
        });
        return updatedStakes;
      });
    }

    // Update super tokens if we have any
    if (ownedSuperTokens.length > 0) {
      setOwnedSuperTokens((prevTokens) => {
        const updatedTokens = prevTokens.map((token) => {
          const cacheKey = `${token.tokenAddress}-${effectiveAddress}`;
          const cachedData = balanceData.get(cacheKey);

          if (cachedData) {
            const formattedBalance = Number(
              formatUnits(cachedData.tokenBalance, 18)
            );
            if (Math.abs(formattedBalance - token.balance) > 0.0001) {
              return {
                ...token,
                balance: formattedBalance,
              };
            }
          }
          return token;
        });
        return updatedTokens;
      });
    }
  }, [balanceData, effectiveAddress, loading]);

  // Animation effect for streaming amounts
  useEffect(() => {
    if (stakes.length === 0) return;

    const updateStreaming = () => {
      if (document.hidden) return; // Pause when tab is hidden

      setStakes((prevStakes) =>
        prevStakes.map((stake) => {
          if (stake.userFlowRate > 0) {
            const elapsed = (Date.now() - stake.lastUpdateTime) / 1000;
            const userFlowRatePerSecond = stake.userFlowRate / 86400;
            const newStreamed = userFlowRatePerSecond * elapsed;
            return {
              ...stake,
              streamedAmount: newStreamed,
            };
          }
          return stake;
        })
      );
    };

    const interval = setInterval(updateStreaming, 50);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Just update immediately when tab becomes visible
        updateStreaming();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stakes.length > 0]);

  // The centralized useTokenData hook handles periodic refresh automatically

  const fetchStakesAndTokens = async () => {
    if (!effectiveAddress) return;

    setLoading(true);
    setError(null);
    setAccountExists(null);

    try {
      // Additional safety check for effectiveAddress
      if (!effectiveAddress || typeof effectiveAddress !== "string") {
        throw new Error("Invalid address provided");
      }

      const accountId = safeToLowerCase(effectiveAddress);

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

      const endpoints = [
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        "https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-base",
      ];

      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              variables: { accountId },
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          if (data.errors) {
            throw new Error(data.errors[0]?.message || "GraphQL query failed");
          }

          const accountData = data.data?.account;

          if (accountData) {
            setAccountExists(true);

            // Process pool memberships (stakes) first
            let stakesData: StakeData[] = [];
            if (accountData.poolMemberships) {
              // Debug: Check raw GraphQL data
              const stremeMemberships = accountData.poolMemberships.filter(
                (m: PoolMembership) => m.pool.token.symbol === "STREME"
              );
              console.log(
                "Raw STREME memberships from GraphQL:",
                stremeMemberships.length,
                stremeMemberships
              );

              const activeMemberships = accountData.poolMemberships.filter(
                (membership: PoolMembership) =>
                  membership.units &&
                  parseFloat(membership.units) > 0 &&
                  !membership.pool.token.isNativeAssetSuperToken &&
                  membership.pool.token.id &&
                  !BLACKLISTED_TOKENS.includes(
                    safeToLowerCase(membership.pool.token.id)
                  )
              );

              // Debug: Check filtered memberships
              const activeStremeMemberships = activeMemberships.filter(
                (m: PoolMembership) => m.pool.token.symbol === "STREME"
              );
              console.log(
                "Active STREME memberships after filtering:",
                activeStremeMemberships.length,
                activeStremeMemberships
              );

              stakesData = await createInitialStakesData(activeMemberships);

              // Debug: Check for STREME in stakes
              const stremeStakes = stakesData.filter(
                (s) => s.membership.pool.token.symbol === "STREME"
              );
              console.log(
                "STREME stakes found:",
                stremeStakes.length,
                stremeStakes
              );

              setStakes(stakesData);
              enhanceStakesWithApiData(stakesData);
            } else {
              setStakes([]);
            }

            // Process SuperTokens
            if (accountData.accountTokenSnapshots) {
              // Debug: Check raw SuperToken snapshots
              const stremeSnapshots = accountData.accountTokenSnapshots.filter(
                (s: AccountTokenSnapshot) => s.token.symbol === "STREME"
              );
              console.log(
                "Raw STREME snapshots from GraphQL:",
                stremeSnapshots.length,
                stremeSnapshots
              );

              const initialSuperTokens = await createInitialSuperTokensData(
                accountData.accountTokenSnapshots,
                stakesData
              );

              // Debug: Check for STREME in SuperTokens
              const stremeSuperTokens = initialSuperTokens.filter(
                (t) => t.symbol === "STREME"
              );
              console.log(
                "STREME SuperTokens found:",
                stremeSuperTokens.length,
                stremeSuperTokens
              );

              setOwnedSuperTokens(initialSuperTokens);
              enhanceSuperTokensWithApiData(initialSuperTokens);
            } else {
              setOwnedSuperTokens([]);
            }
          } else {
            setAccountExists(false);
            setStakes([]);
            setOwnedSuperTokens([]);
          }
          return;
        } catch (err) {
          console.warn(`Failed to fetch from ${endpoint}:`, err);
          lastError = err;
          continue;
        }
      }

      throw lastError || new Error("All endpoints failed");
    } catch (err) {
      console.error("Error fetching stakes:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch stakes");
      setAccountExists(null);
    } finally {
      setLoading(false);
    }
  };

  // Create initial stakes data immediately from GraphQL
  const createInitialStakesData = async (
    memberships: PoolMembership[]
  ): Promise<StakeData[]> => {
    const stakesData: StakeData[] = [];

    const tokenAddresses = memberships
      .map((membership) => membership.pool.token.id)
      .filter(Boolean); // Filter out null/undefined values

    // Fetch token data to get official staking pools
    const tokenDataMap = await fetchTokenDataBatch(tokenAddresses);

    const balanceResults = await fetchBalances(tokenAddresses);
    const balanceMap = new Map(
      balanceResults.map((result) => [result.tokenAddress, result.balance])
    );

    for (const membership of memberships) {
      try {
        const tokenAddress = membership.pool.token.id;
        if (!tokenAddress) {
          console.warn("Skipping membership with null token address");
          continue;
        }

        // Get the official staking pool for this token from the database
        const tokenData = tokenDataMap.get(tokenAddress);
        const officialStakingPool = tokenData?.staking_pool
          ? safeToLowerCase(tokenData.staking_pool)
          : null;
        const membershipPoolId = safeToLowerCase(membership.pool.id);

        // Only create a stake if this membership pool matches the official staking pool
        if (
          officialStakingPool &&
          membershipPoolId !== officialStakingPool
        ) {
          console.log(
            `Skipping membership for ${membership.pool.token.symbol} (${tokenAddress}): membership pool ${membershipPoolId} does not match official staking pool ${officialStakingPool}`
          );
          continue;
        }

        const receivedBalance =
          (balanceMap.get(tokenAddress) as bigint) || BigInt(0);
        const formattedReceived = Number(formatUnits(receivedBalance, 18));

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

        // Debug logging for STREME token
        if (membership.pool.token.symbol === "STREME") {
          console.log("Creating stake for STREME:", {
            tokenAddress,
            poolId: membership.pool.id,
            units: membership.units,
            formattedReceived,
            officialStakingPool,
          });
        }

        stakesData.push({
          membership,
          tokenAddress,
          stakingAddress: "",
          stakingPoolAddress: membership.pool.id,
          receivedBalance: formattedReceived,
          baseAmount: formattedReceived,
          streamedAmount: 0,
          lastUpdateTime: Date.now(),
          userFlowRate,
          stakedBalance: BigInt(0),
          logo: undefined,
        });
      } catch (error) {
        console.error("Error creating initial stake data:", error);
      }
    }

    // Final deduplication step to prevent any duplicate stakes
    // Note: We keep the highest stake if there are multiple pools for the same token
    const uniqueStakes = stakesData.filter((stake, index, self) => {
      const tokenMatches = self.filter(
        (s) =>
          safeToLowerCase(s.tokenAddress) ===
          safeToLowerCase(stake.tokenAddress)
      );

      if (tokenMatches.length === 1) {
        return true; // Only one stake for this token
      }

      // Multiple stakes for same token - keep the one with highest units
      const maxUnitsStake = tokenMatches.reduce((max, current) => {
        const maxUnits = parseFloat(max.membership.units || "0");
        const currentUnits = parseFloat(current.membership.units || "0");
        return currentUnits > maxUnits ? current : max;
      });

      return stake === maxUnitsStake;
    });

    console.log("Stakes deduplication:", {
      original: stakesData.length,
      deduplicated: uniqueStakes.length,
      removed: stakesData.length - uniqueStakes.length,
    });

    return uniqueStakes;
  };

  // Enhance stakes with API data - optimized to reduce calls
  const enhanceStakesWithApiData = async (initialStakes: StakeData[]) => {
    // Only enhance a maximum of 5 tokens at once to reduce API load
    const stakesToEnhance = initialStakes.slice(0, 5);

    // Use batch fetch for token data
    const tokenAddresses = stakesToEnhance.map((stake) => stake.tokenAddress);
    const tokenDataMap = await fetchTokenDataBatch(tokenAddresses);
    const tokenDataResults = tokenAddresses.map((addr) =>
      tokenDataMap.get(addr)
    );

    // Batch all the staked balance calls together
    const stakedBalancePromises = stakesToEnhance.map(async (stake, index) => {
      const tokenData = tokenDataResults[index];
      const stakingAddress = tokenData.staking_address;

      if (
        stakingAddress &&
        stakingAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        try {
          return await publicClient.readContract({
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
          });
        } catch (error) {
          console.warn("Could not fetch staked balance:", error);
          return BigInt(0);
        }
      }
      return BigInt(0);
    });

    // Batch all pool connection calls together
    const poolConnectionPromises = stakesToEnhance.map(async (stake) => {
      if (stake.stakingPoolAddress && effectiveAddress) {
        return await checkPoolConnection(
          stake.stakingPoolAddress,
          effectiveAddress
        );
      }
      return false;
    });

    // Execute both batches in parallel
    const [stakedBalances, poolConnections] = await Promise.all([
      Promise.all(stakedBalancePromises),
      Promise.all(poolConnectionPromises),
    ]);

    // Build enhanced stakes with the batched results
    const enhancedStakes = initialStakes.map((stake, index) => {
      if (index < stakesToEnhance.length) {
        const tokenData = tokenDataResults[index];
        return {
          ...stake,
          stakingAddress: (tokenData.staking_address || "") as string,
          stakedBalance: (stakedBalances[index] || BigInt(0)) as bigint,
          logo: tokenData.logo as string | undefined,
          marketData: tokenData.marketData as typeof stake.marketData,
          lockDuration: (tokenData as CachedTokenData)?.staking?.lockDuration,
          isConnectedToPool: poolConnections[index] as boolean,
        };
      }
      // Return unenhanced stakes for tokens beyond the limit
      return {
        ...stake,
        stakingAddress: "" as string,
        stakedBalance: BigInt(0) as bigint,
        logo: undefined as string | undefined,
        marketData: undefined as typeof stake.marketData,
        lockDuration: undefined,
        isConnectedToPool: false as boolean,
      };
    });

    setStakes(enhancedStakes);

    // Register enhanced tokens as active for auto-refresh
    enhancedStakes.forEach((stake) => {
      registerActiveToken(stake.tokenAddress);
    });

    // Schedule enhancement of remaining tokens if there are any
    if (initialStakes.length > 5) {
      setTimeout(() => {
        const remainingStakes = initialStakes.slice(5);
        enhanceRemainingStakes(remainingStakes, 5); // Start from index 5
      }, 2000); // Wait 2 seconds before enhancing more
    }
  };

  // Helper function to enhance remaining stakes in batches
  const enhanceRemainingStakes = async (
    remainingStakes: StakeData[],
    startIndex: number
  ) => {
    const batchSize = 3; // Smaller batches for remaining tokens
    const batch = remainingStakes.slice(0, batchSize);

    if (batch.length === 0) return;

    try {
      // Use batch fetch for token data
      const tokenAddresses = batch.map((stake) => stake.tokenAddress);
      const tokenDataMap = await fetchTokenDataBatch(tokenAddresses);
      const tokenDataResults = tokenAddresses.map((addr) =>
        tokenDataMap.get(addr)
      );

      const stakedBalancePromises = batch.map(async (stake, index) => {
        const tokenData = tokenDataResults[index];
        const stakingAddress = tokenData.staking_address;

        if (
          stakingAddress &&
          stakingAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          try {
            return await publicClient.readContract({
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
            });
          } catch (error) {
            console.warn("Could not fetch staked balance:", error);
            return BigInt(0);
          }
        }
        return BigInt(0);
      });

      const poolConnectionPromises = batch.map(async (stake) => {
        if (stake.stakingPoolAddress && effectiveAddress) {
          return await checkPoolConnection(
            stake.stakingPoolAddress,
            effectiveAddress
          );
        }
        return false;
      });

      const [stakedBalances, poolConnections] = await Promise.all([
        Promise.all(stakedBalancePromises),
        Promise.all(poolConnectionPromises),
      ]);

      // Update only the specific stakes that were enhanced
      setStakes((prevStakes) =>
        prevStakes.map((stake, globalIndex) => {
          const batchIndex = globalIndex - startIndex;
          if (batchIndex >= 0 && batchIndex < batch.length) {
            const tokenData = tokenDataResults[batchIndex];
            return {
              ...stake,
              stakingAddress: (tokenData.staking_address || "") as string,
              stakedBalance: (stakedBalances[batchIndex] ||
                BigInt(0)) as bigint,
              logo: tokenData.logo as string | undefined,
              marketData: tokenData.marketData as typeof stake.marketData,
              lockDuration: (tokenData as CachedTokenData)?.staking?.lockDuration,
              isConnectedToPool: poolConnections[batchIndex] as boolean,
            };
          }
          return stake;
        })
      );

      // Continue with next batch if there are more
      const nextBatch = remainingStakes.slice(batchSize);
      if (nextBatch.length > 0) {
        setTimeout(() => {
          enhanceRemainingStakes(nextBatch, startIndex + batchSize);
        }, 1000); // 1 second delay between batches
      }
    } catch (error) {
      console.error("Error enhancing remaining stakes:", error);
    }
  };

  // Create initial SuperTokens data
  const createInitialSuperTokensData = async (
    tokenSnapshots: AccountTokenSnapshot[],
    currentStakes: StakeData[]
  ): Promise<SuperTokenData[]> => {
    const superTokensData: SuperTokenData[] = [];

    const validSnapshots = tokenSnapshots.filter(
      (snapshot) =>
        snapshot.balanceUntilUpdatedAt &&
        parseFloat(snapshot.balanceUntilUpdatedAt) > 0 &&
        !snapshot.token.isNativeAssetSuperToken &&
        snapshot.token.id &&
        !BLACKLISTED_TOKENS.includes(safeToLowerCase(snapshot.token.id))
    );

    if (validSnapshots.length === 0) {
      return [];
    }

    const tokenAddresses = validSnapshots.map((snapshot) => snapshot.token.id);
    const balanceResults = await fetchBalances(tokenAddresses);
    const balanceMap = new Map(
      balanceResults.map((result) => [result.tokenAddress, result.balance])
    );

    for (const snapshot of validSnapshots) {
      try {
        const tokenAddress = snapshot.token.id;
        const currentBalance =
          (balanceMap.get(tokenAddress) as bigint) || BigInt(0);
        const formattedBalance = Number(formatUnits(currentBalance, 18));

        const isAlreadyStaked = currentStakes.some(
          (stake) =>
            stake.tokenAddress &&
            tokenAddress &&
            safeToLowerCase(stake.tokenAddress) ===
              safeToLowerCase(tokenAddress)
        );

        // Check if this token has significant unstaked balance (more than 0.01 tokens)
        const hasSignificantBalance = formattedBalance > 0.01;

        // Debug logging for STREME token
        if (snapshot.token.symbol === "STREME") {
          console.log("STREME token processing:", {
            tokenAddress,
            isAlreadyStaked,
            hasSignificantBalance,
            formattedBalance,
            currentStakesCount: currentStakes.length,
            stakesWithSTREME: currentStakes.filter(
              (s) =>
                s.tokenAddress &&
                safeToLowerCase(s.tokenAddress) ===
                  safeToLowerCase(tokenAddress)
            ).length,
          });
        }

        if (!isAlreadyStaked) {
          superTokensData.push({
            tokenAddress,
            symbol: snapshot.token.symbol,
            balance: formattedBalance,
            stakingAddress: undefined,
            isNativeAssetSuperToken: snapshot.token.isNativeAssetSuperToken,
            logo: undefined,
          });
        }
      } catch (error) {
        console.error("Error creating initial SuperToken data:", error);
      }
    }

    // Final deduplication step to prevent any duplicates
    const uniqueSuperTokens = superTokensData.filter(
      (token, index, self) =>
        index ===
        self.findIndex(
          (t) =>
            safeToLowerCase(t.tokenAddress) ===
            safeToLowerCase(token.tokenAddress)
        )
    );

    console.log("SuperTokens deduplication:", {
      original: superTokensData.length,
      deduplicated: uniqueSuperTokens.length,
      removed: superTokensData.length - uniqueSuperTokens.length,
    });

    return uniqueSuperTokens;
  };

  // Enhance SuperTokens with API data - optimized to reduce unnecessary calls
  const enhanceSuperTokensWithApiData = async (
    initialSuperTokens: SuperTokenData[]
  ) => {
    // Only enhance tokens that we actually need to enhance
    // Skip tokens that are clearly not going to have staking
    const tokensToEnhance = initialSuperTokens.filter(
      (token) =>
        // Only enhance if the token has a reasonable balance or we don't know yet
        token.balance > 0.01 || token.stakingAddress === undefined
    );

    // Limit to maximum 8 tokens to reduce API load
    const limitedTokens = tokensToEnhance.slice(0, 8);

    // Use batch fetch for token data
    const tokenAddresses = limitedTokens.map((token) => token.tokenAddress);
    const tokenDataMap = await fetchTokenDataBatch(tokenAddresses);
    const tokenDataResults = tokenAddresses.map((addr) =>
      tokenDataMap.get(addr)
    );

    // Only check pool connections for tokens that actually have staking addresses
    const poolConnectionPromises = limitedTokens.map(async (token, index) => {
      const tokenData = tokenDataResults[index];

      if (tokenData.staking_address && effectiveAddress) {
        const correspondingStake = stakes.find(
          (stake) =>
            stake.tokenAddress &&
            token.tokenAddress &&
            safeToLowerCase(stake.tokenAddress) ===
              safeToLowerCase(token.tokenAddress)
        );
        if (correspondingStake?.stakingPoolAddress) {
          return await checkPoolConnection(
            correspondingStake.stakingPoolAddress,
            effectiveAddress
          );
        }
      }
      return false;
    });

    const poolConnections = await Promise.all(poolConnectionPromises);

    // Build enhanced tokens
    const enhancedSuperTokens = initialSuperTokens.map((token) => {
      const enhanceIndex = limitedTokens.findIndex(
        (t) => t.tokenAddress === token.tokenAddress
      );

      if (enhanceIndex >= 0) {
        const tokenData = tokenDataResults[enhanceIndex];
        return {
          ...token,
          stakingAddress: tokenData.staking_address,
          logo: tokenData.logo,
          marketData: tokenData.marketData,
          isConnectedToPool: poolConnections[enhanceIndex],
        };
      }

      // Return unenhanced token
      return {
        ...token,
        stakingAddress: undefined,
        logo: undefined,
        marketData: undefined,
        isConnectedToPool: false,
      };
    });

    setOwnedSuperTokens(enhancedSuperTokens);

    // Register enhanced SuperTokens as active for auto-refresh
    enhancedSuperTokens.forEach((token) => {
      registerActiveToken(token.tokenAddress);
    });

    // If there are more tokens to enhance, do it later with a delay
    if (tokensToEnhance.length > 8) {
      setTimeout(() => {
        const remainingTokens = tokensToEnhance.slice(8);
        enhanceRemainingTokens(remainingTokens);
      }, 3000); // Wait 3 seconds before enhancing more SuperTokens
    }
  };

  // Helper to enhance remaining SuperTokens in smaller batches
  const enhanceRemainingTokens = async (remainingTokens: SuperTokenData[]) => {
    const batchSize = 4;
    const batch = remainingTokens.slice(0, batchSize);

    if (batch.length === 0) return;

    try {
      // Use batch fetch for token data
      const tokenAddresses = batch.map((token) => token.tokenAddress);
      const tokenDataMap = await fetchTokenDataBatch(tokenAddresses);
      const tokenDataResults = tokenAddresses.map((addr) =>
        tokenDataMap.get(addr)
      );

      const poolConnectionPromises = batch.map(async (token, index) => {
        const tokenData = tokenDataResults[index];

        if (tokenData.staking_address && effectiveAddress) {
          const correspondingStake = stakes.find(
            (stake) =>
              stake.tokenAddress &&
              token.tokenAddress &&
              safeToLowerCase(stake.tokenAddress) ===
                safeToLowerCase(token.tokenAddress)
          );
          if (correspondingStake?.stakingPoolAddress) {
            return await checkPoolConnection(
              correspondingStake.stakingPoolAddress,
              effectiveAddress
            );
          }
        }
        return false;
      });

      const poolConnections = await Promise.all(poolConnectionPromises);

      // Update only the specific tokens that were enhanced
      setOwnedSuperTokens((prevTokens) =>
        prevTokens.map((token) => {
          const batchIndex = batch.findIndex(
            (t) => t.tokenAddress === token.tokenAddress
          );

          if (batchIndex >= 0) {
            const tokenData = tokenDataResults[batchIndex];
            return {
              ...token,
              stakingAddress: tokenData.staking_address,
              logo: tokenData.logo,
              marketData: tokenData.marketData,
              isConnectedToPool: poolConnections[batchIndex],
            };
          }
          return token;
        })
      );

      // Continue with next batch
      const nextBatch = remainingTokens.slice(batchSize);
      if (nextBatch.length > 0) {
        setTimeout(() => {
          enhanceRemainingTokens(nextBatch);
        }, 2000); // 2 second delay between SuperToken batches
      }
    } catch (error) {
      console.error("Error enhancing remaining SuperTokens:", error);
    }
  };

  // Helper functions for updates

  const updateStakedBalance = async (
    stakingAddress: string,
    tokenAddress: string
  ) => {
    if (!effectiveAddress) return;

    try {
      const stakedBalance = await publicClient.readContract({
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
      });

      setStakes((prevStakes) =>
        prevStakes.map((stake) => {
          if (stake.tokenAddress === tokenAddress) {
            return {
              ...stake,
              stakedBalance: stakedBalance as bigint,
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
      const isConnected = await checkPoolConnection(
        poolAddress,
        effectiveAddress
      );

      setStakes((prevStakes) =>
        prevStakes.map((stake) => {
          if (stake.tokenAddress === tokenAddress) {
            return {
              ...stake,
              isConnectedToPool: isConnected,
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
      const stakeData = stakes.find((s) => s.tokenAddress === tokenAddress);
      await refreshTokenData(
        tokenAddress,
        stakingAddress,
        stakeData?.stakingPoolAddress
      );

      // Also update staked balance if staking address is provided
      if (stakingAddress) {
        updateStakedBalance(stakingAddress, tokenAddress);
      }

      // For stakes, also trigger a full refresh to get updated flow rates
      // This is needed because stakes have complex data that needs GraphQL updates
      setTimeout(() => {
        fetchStakesAndTokens();
      }, 1000);
    } else {
      // Fallback to refreshing all data
      await refreshAllData();
      setTimeout(() => {
        fetchStakesAndTokens();
      }, 1000);
    }
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
    setTimeout(() => {
      fetchStakesAndTokens();
    }, 2000);
  };

  const calculateSharePercentage = (units: string, totalUnits: string) => {
    if (!units || !totalUnits || totalUnits === "0") return "0";
    const percentage = (parseFloat(units) / parseFloat(totalUnits)) * 100;
    return percentage.toFixed(2);
  };

  const formatMarketCap = (marketCap: number | undefined) => {
    if (!marketCap) return "-";

    if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(1)}M`;
    } else if (marketCap >= 1000) {
      return `$${(marketCap / 1000).toFixed(1)}K`;
    } else {
      return `$${marketCap.toFixed(0)}`;
    }
  };

  const format24hChange = (change24h: number | undefined) => {
    if (change24h === undefined) return "-";
    const isPositive = change24h >= 0;
    return (
      <span className={isPositive ? "text-green-500" : "text-red-500"}>
        {isPositive ? "+" : ""}
        {change24h.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-8 relative">
      {/* Background Animation */}
      <div className="fixed inset-0 -z-10">
        <HeroAnimationMini />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Tokens</h1>
          {/* <p className="text-gray-600">Manage your Streme tokens</p> */}
        </div>

        {!mounted ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="card bg-base-100 border border-gray-200 animate-pulse"
              >
                <div className="card-body p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300"></div>
                      <div>
                        <div className="h-6 bg-gray-300 rounded w-24 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                    <div className="h-6 bg-gray-300 rounded w-20"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !effectiveAddress ? (
          <div className="text-center py-16">
            <div className="mb-6">
              <svg
                className="w-20 h-20 mx-auto text-gray-300"
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
            <h3 className="text-xl font-semibold mb-4">
              Wallet Connection Required
            </h3>
            <p className="text-gray-500 mb-6">
              Please connect your wallet to view your stakes and SuperTokens.
            </p>
            {!isMiniAppView && (
              <button className="btn btn-primary">Connect Wallet</button>
            )}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="card bg-base-100 border border-gray-200 animate-pulse"
              >
                <div className="card-body p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300"></div>
                      <div>
                        <div className="h-6 bg-gray-300 rounded w-24 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                    <div className="h-6 bg-gray-300 rounded w-20"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="alert alert-error max-w-md mx-auto">
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
              className="btn btn-primary mt-6"
            >
              Retry
            </button>
          </div>
        ) : stakes.length === 0 && ownedSuperTokens.length === 0 ? (
          <div className="text-center py-16">
            <div className="mb-6">
              <svg
                className="w-20 h-20 mx-auto text-gray-300"
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
                <h3 className="text-xl font-semibold mb-4">
                  Welcome to Streme!
                </h3>
                <p className="text-gray-500 mb-6">
                  You haven&apos;t interacted with any tokens yet. Start by
                  exploring and staking in your favorite tokens!
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/" className="btn btn-primary">
                    Explore Tokens
                  </Link>
                  <a
                    href="https://docs.superfluid.org/docs/sdk/distributions/subgraph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                  >
                    Learn More
                  </a>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-4">
                  No Stakes or SuperTokens Found
                </h3>
                <p className="text-gray-500 mb-6">
                  You don&apos;t have any active stakes or SuperTokens yet.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/" className="btn btn-primary">
                    Explore Tokens
                  </Link>
                  <a
                    href="https://docs.superfluid.org/docs/sdk/distributions/subgraph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                  >
                    Learn About Superfluid
                  </a>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card bg-base-100 border">
                <div className="card-body p-6">
                  <h3 className="text-lg font-semibold mb-2">Staked Tokens</h3>
                  <p className="text-3xl font-bold text-primary">
                    {stakes.length}
                  </p>
                </div>
              </div>
              <div className="card bg-base-100 border">
                <div className="card-body p-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Unstaked Tokens
                  </h3>
                  <p className="text-3xl font-bold text-secondary">
                    {ownedSuperTokens.length}
                  </p>
                </div>
              </div>
              <div className="card bg-base-100 border">
                <div className="card-body p-6">
                  <h3 className="text-lg font-semibold mb-2">Total Tokens</h3>
                  <p className="text-3xl font-bold text-accent">
                    {stakes.length + ownedSuperTokens.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Staked Tokens Section */}
            {stakes.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Staked Tokens</h2>
                  <TopUpAllStakesButton
                    stakes={stakes}
                    ownedSuperTokens={ownedSuperTokens}
                    onSuccess={() => handleStakeSuccess()}
                    className="btn btn-primary"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stakes
                    .slice()
                    .sort((a, b) => {
                      // Sort by staked amount (units) in descending order (highest stake first)
                      const aUnits = parseFloat(a.membership.units || "0");
                      const bUnits = parseFloat(b.membership.units || "0");
                      return bUnits - aUnits;
                    })
                    .map((stake, index) => (
                      <div
                        key={`stake-${stake.tokenAddress}-${index}`}
                        className="card bg-base-100 border border-gray-200"
                      >
                        <div className="card-body p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                                {stake.logo ? (
                                  <img
                                    src={stake.logo}
                                    alt={stake.membership.pool.token.symbol}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      target.nextElementSibling!.classList.remove(
                                        "hidden"
                                      );
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`${
                                    stake.logo ? "hidden" : ""
                                  } w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold`}
                                >
                                  {stake.membership.pool.token.symbol.charAt(0)}
                                </div>
                              </div>
                              <div>
                                <Link
                                  href={`/token/${stake.tokenAddress}`}
                                  className="hover:text-blue-600 transition-colors"
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
                                </Link>
                              </div>
                            </div>
                            <div className="flex flex-col items-end text-right">
                              <div className="text-xs uppercase tracking-wider opacity-50">
                                MCAP
                              </div>
                              <div className="flex gap-2 items-baseline">
                                <div className="font-mono text-sm font-bold">
                                  {formatMarketCap(stake.marketData?.marketCap)}
                                </div>
                                <div className="text-xs">
                                  {format24hChange(
                                    stake.marketData?.priceChange24h
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 text-sm mb-4">
                            <div>
                              <p className="text-gray-500">Staked Amount</p>
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

                            {stake.isConnectedToPool ? (
                              <div>
                                <p className="text-gray-500">Current Balance</p>
                                <div className="flex items-center">
                                  <p className="font-mono text-green-600">
                                    {(
                                      stake.baseAmount + stake.streamedAmount
                                    ).toLocaleString("en-US", {
                                      minimumFractionDigits: 6,
                                      maximumFractionDigits: 6,
                                    })}
                                    <span className="ml-1">
                                      {stake.membership.pool.token.symbol}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            ) : stake.stakingAddress &&
                              stake.stakingAddress !== "" &&
                              stake.isConnectedToPool === false ? (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                  <span className="text-sm font-medium text-gray-700">
                                    Not connected to reward pool
                                  </span>
                                </div>
                                {stake.stakedBalance > 0n && (
                                  <p className="text-xs text-gray-500 mb-3 text-center">
                                    Connect to start receiving rewards
                                  </p>
                                )}
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
                                    />
                                  )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-gray-500">Current Balance</p>
                                <div className="flex items-center">
                                  <p className="font-mono text-green-600">
                                    {(
                                      stake.baseAmount + stake.streamedAmount
                                    ).toLocaleString("en-US", {
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

                          {stake.stakingAddress &&
                          stake.stakingAddress !==
                            "0x0000000000000000000000000000000000000000" ? (
                            <div className="space-y-2">
                              <div className="flex">
                                <StakeButton
                                  tokenAddress={stake.tokenAddress}
                                  stakingAddress={stake.stakingAddress}
                                  stakingPoolAddress={stake.stakingPoolAddress}
                                  symbol={stake.membership.pool.token.symbol}
                                  tokenBalance={BigInt(
                                    Math.round(
                                      (stake.baseAmount +
                                        stake.streamedAmount) *
                                        1e18
                                    )
                                  )}
                                  onSuccess={() =>
                                    handleStakeSuccess(
                                      stake.tokenAddress,
                                      stake.stakingAddress
                                    )
                                  }
                                  className="btn btn-primary btn-sm w-full"
                                  lockDuration={stake.lockDuration}
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
                </div>
              </div>
            )}

            {/* Available SuperTokens Section */}
            {ownedSuperTokens.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Available to Stake</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ownedSuperTokens
                    .slice()
                    .sort((a, b) => {
                      // Sort by balance in descending order (highest balance first)
                      return b.balance - a.balance;
                    })
                    .map((token, index) => (
                      <div
                        key={`supertoken-${token.tokenAddress}-${index}`}
                        className="card bg-base-100 border border-gray-200"
                      >
                        <div className="card-body p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                                {token.logo ? (
                                  <img
                                    src={token.logo}
                                    alt={token.symbol}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      target.nextElementSibling!.classList.remove(
                                        "hidden"
                                      );
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`${
                                    token.logo ? "hidden" : ""
                                  } w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold`}
                                >
                                  {token.symbol.charAt(0)}
                                </div>
                              </div>
                              <div>
                                <Link
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
                                </Link>
                              </div>
                            </div>
                            <div className="flex flex-col items-end text-right">
                              <div className="text-xs uppercase tracking-wider opacity-50">
                                MCAP
                              </div>
                              <div className="flex gap-2 items-baseline">
                                <div className="font-mono text-sm font-bold">
                                  {formatMarketCap(token.marketData?.marketCap)}
                                </div>
                                <div className="text-xs">
                                  {format24hChange(
                                    token.marketData?.priceChange24h
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 text-sm mb-4">
                            <div>
                              <p className="text-gray-500">Balance</p>
                              <p className="font-mono text-blue-600">
                                {token.balance.toLocaleString("en-US", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}
                                <span className="ml-1">{token.symbol}</span>
                              </p>
                            </div>
                          </div>

                          {token.stakingAddress ? (
                            <div className="">
                              <div className="flex">
                                <StakeButton
                                  tokenAddress={token.tokenAddress}
                                  stakingAddress={token.stakingAddress}
                                  stakingPoolAddress=""
                                  symbol={token.symbol}
                                  tokenBalance={BigInt(
                                    Math.round(token.balance * 1e18)
                                  )}
                                  onSuccess={() =>
                                    handleSuperTokenStakeSuccess(
                                      token.tokenAddress
                                    )
                                  }
                                  className="btn btn-primary btn-sm w-full"
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unstaked Tokens Modal */}
      {/* {showUnstakedModal && mounted && !loading && (
        <UnstakedTokensModal
          unstakedTokens={ownedSuperTokens}
          onDismiss={async () => {
            setShowUnstakedModal(false);
            // Refresh all centralized data after staking
            await refreshAllData();
            // Also refresh stakes and tokens to update UI
            await fetchStakesAndTokens();
          }}
        />
      )} */}
    </div>
  );
}
