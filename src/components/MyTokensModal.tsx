"use client";

import { useState, useEffect } from "react";
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

// Cache for token data to avoid repeated API calls
const tokenDataCache = new Map<
  string,
  {
    staking_address?: string;
    logo?: string;
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
>();

// Cache for balance data to avoid repeated API calls
const balanceCache = new Map<
  string,
  {
    balance: bigint;
    timestamp: number;
  }
>();

// Cache for pool connection status to reduce repeated calls
const poolConnectionCache = new Map<
  string,
  {
    isConnected: boolean;
    timestamp: number;
  }
>();

const BALANCE_CACHE_DURATION = 300000; // 5 minutes cache
const POOL_CONNECTION_CACHE_DURATION = 600000; // 10 minutes cache for pool connections

// Blacklisted token addresses to filter out
const BLACKLISTED_TOKENS = [
  "0x1efF3Dd78F4A14aBfa9Fa66579bD3Ce9E1B30529",
  "0xe58267cd7299c29a1b77F4E66Cd12Dd24a2Cd2FD",
  "0x8414Ab8C70c7b16a46012d49b8111959Baf2fC42",
  "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93",
  "0x304989dA2AdC80a6568170567D477Af5E48DBaAe",
  "0xDFd428908909CB5E24F5e79E6aD6BDE10bdf2327",
  "0x58122a048878F25C8C5d4b562419500ED74C6f75",
  "0x4E395eC7b71Dd87A23dD836edb3eFE15A6c2002B",
  "0x09b1AD979d093377e201d804Fa9aC0a9a07cfB0b",
  "0xefbE11336b0008dCE3797C515E6457cC4841645c",
  "0x5f2Fab273F1F64b6bc6ab8F35314CD21501F35C5",
  "0x9097E4A4D75A611b65aB21d98A7D5b1177C050F7",
  "0x1BA8603DA702602A8657980e825A6DAa03Dee93a",
  "0xfe2224bd9c4aFf648F93B036172444C533DbF116",
  "0xd04383398dd2426297da660f9cca3d439af9ce1b",
  "0x7ef392131c3ab326016cf7b560f96c91f4f9d4fa",
].map((addr) => addr?.toLowerCase() || "");

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

  // Get effective address based on context
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;
  const effectiveIsConnected = isMiniAppView ? fcIsConnected : !!wagmiAddress;

  // Helper function to safely call toLowerCase on potentially null values
  const safeToLowerCase = (value: string | null | undefined): string => {
    if (!value || typeof value !== "string") {
      return "";
    }
    return value.toLowerCase();
  };

  // Enhanced API rate limiting - much more permissive
  const rateLimitedFetch = async (url: string, options?: RequestInit) => {
    // Remove artificial rate limiting for better UX
    return fetch(url, options);
  };

  // Helper function to fetch token data with enhanced caching and rate limiting
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
      const response = await rateLimitedFetch(
        `/api/tokens/single?address=${tokenAddress}`
      );
      if (response.ok) {
        const result = await response.json();
        const tokenData = {
          staking_address: result.data?.staking_address,
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
      if (error instanceof Error && error.message === "Rate limited") {
        console.log("Skipping token data fetch due to rate limiting");
      } else {
        console.warn("Could not fetch token data for:", tokenAddress, error);
      }
    }

    const fallbackData = {
      staking_address: undefined,
      logo: undefined,
      marketData: undefined,
    };
    tokenDataCache.set(tokenAddress, fallbackData);
    return fallbackData;
  };

  // Helper function to batch balance calls with basic caching
  const fetchBalances = async (tokenAddresses: string[]) => {
    const now = Date.now();

    // Check cache first and only fetch for tokens that need updating
    const tokensToFetch: string[] = [];
    const cachedResults: Array<{ tokenAddress: string; balance: bigint }> = [];

    tokenAddresses.forEach((tokenAddress) => {
      const cached = balanceCache.get(tokenAddress);
      if (cached && now - cached.timestamp < BALANCE_CACHE_DURATION) {
        cachedResults.push({ tokenAddress, balance: cached.balance });
      } else {
        tokensToFetch.push(tokenAddress);
      }
    });

    // If all tokens are cached, return cached results
    if (tokensToFetch.length === 0) {
      return cachedResults;
    }

    console.log(
      `Fetching balances for ${tokensToFetch.length} tokens (${cachedResults.length} cached)`
    );

    const balancePromises = tokensToFetch.map(async (tokenAddress) => {
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

        // Cache the result
        balanceCache.set(tokenAddress, {
          balance: balance as bigint,
          timestamp: now,
        });

        return { tokenAddress, balance: balance as bigint };
      } catch (error) {
        console.warn("Failed to fetch balance for:", tokenAddress, error);
        const fallbackBalance = BigInt(0);

        // Cache the fallback balance with a shorter duration
        balanceCache.set(tokenAddress, {
          balance: fallbackBalance,
          timestamp: now,
        });

        return { tokenAddress, balance: fallbackBalance };
      }
    });

    const fetchedResults = await Promise.all(balancePromises);

    // Combine cached and fetched results
    return [...cachedResults, ...fetchedResults];
  };

  // Helper function to check pool connection status with caching
  const checkPoolConnection = async (
    poolAddress: string,
    userAddress: string
  ): Promise<boolean> => {
    const cacheKey = `${poolAddress}-${userAddress}`;
    const cached = poolConnectionCache.get(cacheKey);
    const now = Date.now();

    // Return cached result if still valid
    if (cached && now - cached.timestamp < POOL_CONNECTION_CACHE_DURATION) {
      return cached.isConnected;
    }

    try {
      const connectedStatus = await publicClient.readContract({
        address: GDA_FORWARDER,
        abi: GDA_ABI,
        functionName: "isMemberConnected",
        args: [poolAddress as `0x${string}`, userAddress as `0x${string}`],
      });

      const isConnected = connectedStatus as boolean;

      // Cache the result
      poolConnectionCache.set(cacheKey, {
        isConnected,
        timestamp: now,
      });

      return isConnected;
    } catch (error) {
      console.error("Error checking pool connection:", error);
      // Cache negative result for shorter duration
      poolConnectionCache.set(cacheKey, {
        isConnected: false,
        timestamp: now,
      });
      return false;
    }
  };

  useEffect(() => {
    if (isOpen && effectiveAddress) {
      fetchStakesAndTokens();
    }
  }, [isOpen, effectiveAddress]);

  // Periodic balance refresh - much less aggressive, only for critical tokens
  useEffect(() => {
    if (!effectiveAddress || stakes.length === 0) return;

    const refreshBalances = async () => {
      try {
        // Only refresh balances for stakes that have staking addresses and meaningful flow rates
        const criticalStakes = stakes.filter(
          (stake) =>
            stake.stakingAddress &&
            stake.stakingAddress !== "" &&
            stake.userFlowRate > 0.1 // Only high-value streaming stakes
        );

        if (criticalStakes.length === 0) return;

        // Limit to maximum 2 tokens to reduce Alchemy calls
        const limitedStakes = criticalStakes.slice(0, 2);
        const tokenAddresses = limitedStakes.map((stake) => stake.tokenAddress);
        const balanceResults = await fetchBalances(tokenAddresses);
        const balanceMap = new Map(
          balanceResults.map((result) => [result.tokenAddress, result.balance])
        );

        setStakes((prevStakes) =>
          prevStakes.map((stake) => {
            if (tokenAddresses.includes(stake.tokenAddress)) {
              const currentBalance =
                (balanceMap.get(stake.tokenAddress) as bigint) || BigInt(0);
              const formattedBalance = Number(formatUnits(currentBalance, 18));

              // Only update if there's a significant change (increased threshold)
              if (Math.abs(formattedBalance - stake.baseAmount) > 0.01) {
                // Increased from 0.001 to 0.01
                return {
                  ...stake,
                  receivedBalance: formattedBalance,
                  baseAmount: formattedBalance,
                  lastUpdateTime: Date.now(),
                };
              }
            }
            return stake;
          })
        );
      } catch (error) {
        console.error("Error refreshing balances:", error);
        // Don't show toast error for background refresh failures
        // to avoid spamming users with error messages
      }
    };

    // Refresh much less frequently - every 20 minutes instead of 10
    const interval = setInterval(refreshBalances, 1200000); // 20 minutes
    return () => clearInterval(interval);
  }, [effectiveAddress, stakes.length]);

  const fetchStakesAndTokens = async () => {
    if (!effectiveAddress) return;

    setLoading(true);
    setError(null);
    setAccountExists(null);

    try {
      // Create the account ID for the subgraph query (address in lowercase)
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

      // Try multiple endpoints in case one doesn't work
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

          // If we get here, the query was successful
          const accountData = data.data?.account;
          console.log("Full GraphQL response:", data);
          console.log("Account data:", accountData);

          if (accountData) {
            setAccountExists(true);

            // **CONSOLIDATED APPROACH**: Process all tokens together to avoid duplicates
            await processAllTokensConsolidated(accountData);
          } else {
            // Account doesn't exist in the subgraph yet
            console.log(
              "No account data found - account may not have interacted with Superfluid yet"
            );
            setAccountExists(false);
            setStakes([]);
            setOwnedSuperTokens([]);
          }
          return; // Success, exit the function
        } catch (err) {
          console.warn(`Failed to fetch from ${endpoint}:`, err);
          lastError = err;
          continue; // Try the next endpoint
        }
      }

      // If we get here, all endpoints failed
      throw lastError || new Error("All endpoints failed");
    } catch (err) {
      console.error("Error fetching stakes:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch stakes");
      setAccountExists(null);
    } finally {
      setLoading(false);
    }
  };

  // **NEW CONSOLIDATED FUNCTION**: Process all tokens in one go to eliminate duplicates
  const processAllTokensConsolidated = async (accountData: {
    poolMemberships?: PoolMembership[];
    accountTokenSnapshots?: AccountTokenSnapshot[];
  }) => {
    // Step 1: Collect all unique token addresses
    const allTokenAddresses = new Set<string>();
    const stakesMembers: PoolMembership[] = [];
    const superTokenSnapshots: AccountTokenSnapshot[] = [];

    // Process pool memberships (stakes)
    if (accountData.poolMemberships) {
      const activeMemberships = accountData.poolMemberships.filter(
        (membership: PoolMembership) =>
          membership.units &&
          parseFloat(membership.units) > 0 &&
          !membership.pool.token.isNativeAssetSuperToken &&
          !BLACKLISTED_TOKENS.includes(
            safeToLowerCase(membership.pool.token.id)
          )
      );

      activeMemberships.forEach((membership: PoolMembership) => {
        allTokenAddresses.add(membership.pool.token.id);
        stakesMembers.push(membership);
      });
    }

    // Process SuperToken snapshots
    if (accountData.accountTokenSnapshots) {
      const validSnapshots = accountData.accountTokenSnapshots.filter(
        (snapshot: AccountTokenSnapshot) =>
          snapshot.balanceUntilUpdatedAt &&
          parseFloat(snapshot.balanceUntilUpdatedAt) > 0 &&
          !snapshot.token.isNativeAssetSuperToken &&
          !BLACKLISTED_TOKENS.includes(safeToLowerCase(snapshot.token.id))
      );

      validSnapshots.forEach((snapshot: AccountTokenSnapshot) => {
        allTokenAddresses.add(snapshot.token.id);
        superTokenSnapshots.push(snapshot);
      });
    }

    const uniqueTokens = Array.from(allTokenAddresses);
    console.log(`Processing ${uniqueTokens.length} unique tokens total`);

    if (uniqueTokens.length === 0) {
      setStakes([]);
      setOwnedSuperTokens([]);
      return;
    }

    // Step 2: **SINGLE BATCH** - Fetch all data for all tokens at once
    const [balanceResults, tokenDataResults] = await Promise.all([
      fetchBalances(uniqueTokens), // One balance call for all tokens
      Promise.all(uniqueTokens.map(fetchTokenData)), // One token data call for all tokens
    ]);

    // Create lookup maps for easy access
    const balanceMap = new Map(
      balanceResults.map((result) => [result.tokenAddress, result.balance])
    );
    const tokenDataMap = new Map(
      uniqueTokens.map((token, index) => [token, tokenDataResults[index]])
    );

    // Step 3: Build initial stakes data using the consolidated results
    const stakesData: StakeData[] = [];
    for (const membership of stakesMembers) {
      try {
        const tokenAddress = membership.pool.token.id;
        const receivedBalance =
          (balanceMap.get(tokenAddress) as bigint) || BigInt(0);
        const formattedReceived = Number(formatUnits(receivedBalance, 18));

        // Calculate user flow rate
        const totalUnits = BigInt(membership.pool.totalUnits || "0");
        const memberUnits = BigInt(membership.units || "0");
        let userFlowRate = 0;

        if (totalUnits > 0n) {
          const percentage = (Number(memberUnits) * 100) / Number(totalUnits);
          const totalFlowRate = Number(
            formatUnits(BigInt(membership.pool.flowRate), 18)
          );
          userFlowRate = totalFlowRate * (percentage / 100) * 86400; // per day
        }

        const tokenData = tokenDataMap.get(tokenAddress);
        stakesData.push({
          membership,
          tokenAddress,
          stakingAddress: tokenData?.staking_address || "",
          stakingPoolAddress: membership.pool.id,
          receivedBalance: formattedReceived,
          baseAmount: formattedReceived,
          lastUpdateTime: Date.now(),
          userFlowRate,
          stakedBalance: BigInt(0), // Will be filled by enhancement
          logo: tokenData?.logo,
          marketData: tokenData?.marketData,
          isConnectedToPool: false, // Will be filled by enhancement
        });
      } catch (error) {
        console.error("Error creating stake data:", error);
      }
    }

    // Step 4: Build SuperTokens data using the consolidated results
    const superTokensData: SuperTokenData[] = [];
    for (const snapshot of superTokenSnapshots) {
      try {
        const tokenAddress = snapshot.token.id;
        const currentBalance =
          (balanceMap.get(tokenAddress) as bigint) || BigInt(0);
        const formattedBalance = Number(formatUnits(currentBalance, 18));

        // Check if this token is already staked (to avoid duplicates)
        const isAlreadyStaked = stakesData.some(
          (stake) =>
            stake.tokenAddress &&
            tokenAddress &&
            safeToLowerCase(stake.tokenAddress) ===
              safeToLowerCase(tokenAddress)
        );

        if (!isAlreadyStaked) {
          const tokenData = tokenDataMap.get(tokenAddress);
          superTokensData.push({
            tokenAddress,
            symbol: snapshot.token.symbol,
            balance: formattedBalance,
            stakingAddress: tokenData?.staking_address,
            isNativeAssetSuperToken: snapshot.token.isNativeAssetSuperToken,
            logo: tokenData?.logo,
            marketData: tokenData?.marketData,
            isConnectedToPool: false, // Not needed for SuperTokens initially
          });
        }
      } catch (error) {
        console.error("Error creating SuperToken data:", error);
      }
    }

    // Step 5: Set initial data immediately (users can see and interact with tokens)
    setStakes(stakesData);
    setOwnedSuperTokens(superTokensData);

    // Step 6: **SINGLE ENHANCEMENT PASS** for remaining blockchain calls
    await enhanceWithBlockchainData(stakesData);
  };

  // **SINGLE ENHANCEMENT FUNCTION**: Only fetch staked balances and pool connections
  const enhanceWithBlockchainData = async (stakesData: StakeData[]) => {
    if (stakesData.length === 0) return;

    console.log(
      `Final enhancement: fetching staked balances and pool connections for ${stakesData.length} stakes`
    );

    // Only make additional blockchain calls for stakes that have staking addresses
    const stakesWithStaking = stakesData.filter(
      (stake) =>
        stake.stakingAddress &&
        stake.stakingAddress !== "" &&
        stake.stakingAddress !== "0x0000000000000000000000000000000000000000"
    );

    if (stakesWithStaking.length === 0) {
      console.log("No stakes require additional blockchain calls");
      return;
    }

    // Fetch staked balances and pool connections in parallel
    const [stakedBalances, poolConnections] = await Promise.all([
      // Staked balance calls
      Promise.all(
        stakesWithStaking.map(async (stake) => {
          try {
            return await publicClient.readContract({
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
          } catch (error) {
            console.warn("Could not fetch staked balance:", error);
            return BigInt(0);
          }
        })
      ),
      // Pool connection calls
      Promise.all(
        stakesWithStaking.map(async (stake) => {
          if (stake.stakingPoolAddress && effectiveAddress) {
            return await checkPoolConnection(
              stake.stakingPoolAddress,
              effectiveAddress
            );
          }
          return false;
        })
      ),
    ]);

    // Update only the stakes that had additional data to fetch
    setStakes((prevStakes) =>
      prevStakes.map((stake) => {
        const enhanceIndex = stakesWithStaking.findIndex(
          (s) => s.tokenAddress === stake.tokenAddress
        );

        if (enhanceIndex >= 0) {
          return {
            ...stake,
            stakedBalance:
              (stakedBalances[enhanceIndex] as bigint) || BigInt(0),
            isConnectedToPool: poolConnections[enhanceIndex] as boolean,
          };
        }

        return stake;
      })
    );

    console.log(
      `Enhanced ${stakesWithStaking.length} stakes with blockchain data`
    );
  };

  const calculateSharePercentage = (units: string, totalUnits: string) => {
    if (!units || !totalUnits || totalUnits === "0") return "0";
    const percentage = (parseFloat(units) / parseFloat(totalUnits)) * 100;
    return percentage.toFixed(2);
  };

  // Helper function to format market cap like in TokenGrid
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

  // Helper function to format 24h change
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

  // Targeted update functions to avoid full refresh
  const updateStakeBalances = async (tokenAddresses?: string[]) => {
    if (!effectiveAddress) return;

    try {
      const addressesToUpdate =
        tokenAddresses || stakes.map((stake) => stake.tokenAddress);
      const balanceResults = await fetchBalances(addressesToUpdate);
      const balanceMap = new Map(
        balanceResults.map((result) => [result.tokenAddress, result.balance])
      );

      setStakes((prevStakes) =>
        prevStakes.map((stake) => {
          if (!tokenAddresses || tokenAddresses.includes(stake.tokenAddress)) {
            const currentBalance =
              (balanceMap.get(stake.tokenAddress) as bigint) || BigInt(0);
            const formattedBalance = Number(formatUnits(currentBalance, 18));

            return {
              ...stake,
              receivedBalance: formattedBalance,
              baseAmount: formattedBalance,
              lastUpdateTime: Date.now(),
            };
          }
          return stake;
        })
      );
    } catch (error) {
      console.error("Error updating stake balances:", error);
    }
  };

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

  const handleStakeSuccess = (
    tokenAddress?: string,
    stakingAddress?: string
  ) => {
    // Instead of full refresh, do targeted updates
    if (tokenAddress) {
      // Update the specific token's balance
      updateStakeBalances([tokenAddress]);

      // If staking address is provided, update staked balance too
      if (stakingAddress) {
        updateStakedBalance(stakingAddress, tokenAddress);
      }
    } else {
      // Fallback to updating all balances if no specific token provided
      updateStakeBalances();
    }
  };

  const handleConnectPoolSuccess = (
    poolAddress: string,
    tokenAddress: string
  ) => {
    // Update pool connection status and balances for the specific token
    updatePoolConnectionStatus(poolAddress, tokenAddress);
    updateStakeBalances([tokenAddress]);
  };

  const handleSuperTokenStakeSuccess = (tokenAddress: string) => {
    // When a SuperToken gets staked, we need to refresh the data to move it to the staked section
    // This is one case where we might need a more comprehensive refresh
    // For now, let's do a targeted update and let the periodic refresh handle the reorganization
    updateStakeBalances([tokenAddress]);

    // Optionally trigger a full refresh after a short delay to reorganize the sections
    setTimeout(() => {
      fetchStakesAndTokens();
    }, 2000);
  };

  // Manual refresh function for users to force enhancement
  const handleManualRefresh = async () => {
    if (refreshing || !effectiveAddress) return;

    setRefreshing(true);
    try {
      // Simply re-fetch all data - fast and comprehensive
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

        {/* Top-up All Stakes Button - show only when there are stakes */}
        {stakes.length > 0 && (
          <div className="mb-4">
            <TopUpAllStakesButton
              stakes={stakes}
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
                  className="w-16 h-16 mx-auto text-gray-300"
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
              <p className="text-gray-500 mb-4">
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
                  className="card bg-base-100 border border-gray-200 animate-pulse"
                >
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-300"></div>
                        <div>
                          <div className="h-5 bg-gray-300 rounded w-20 mb-1"></div>
                          <div className="h-3 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-gray-300 rounded w-16"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
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
                  className="w-16 h-16 mx-auto text-gray-300"
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
                  <p className="text-gray-500 mb-4">
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
                  <p className="text-gray-500 mb-4">
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
                {stakes.map((stake, index) => (
                  <div
                    key={`stake-${index}`}
                    className="card bg-base-100 border border-gray-200"
                  >
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          {/* Token Logo */}
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                            {stake.logo ? (
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
                                stake.logo ? "hidden" : ""
                              } w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold`}
                            >
                              {stake.membership.pool.token.symbol.charAt(0)}
                            </div>
                          </div>
                          <div>
                            <a
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
                            </a>
                          </div>
                        </div>
                        <div className="flex flex-col items-start">
                          <div className="text-right text-xs uppercase tracking-wider opacity-50">
                            MKT CAP
                          </div>
                          <div className="flex gap-2 items-baseline">
                            <div className="font-mono text-sm font-bold">
                              {formatMarketCap(stake.marketData?.marketCap)}
                            </div>
                            <div className="text-xs mt-1">
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

                        {/* Show Current Balance if connected, or Pool Connection Status if not connected */}
                        {stake.isConnectedToPool ? (
                          <div>
                            <p className="text-gray-500">Current Balance</p>
                            <div className="flex items-center">
                              <p className="font-mono text-green-600">
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
                            <p className="text-gray-500">Current Balance</p>
                            <div className="flex items-center">
                              <p className="font-mono text-green-600">
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
                      {stake.stakingAddress &&
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
                                Math.floor(stake.baseAmount * 1e18)
                              )}
                              onSuccess={() =>
                                handleStakeSuccess(
                                  stake.tokenAddress,
                                  stake.stakingAddress
                                )
                              }
                              className="btn btn-primary btn-sm"
                              isMiniApp={isMiniAppView}
                              farcasterAddress={effectiveAddress}
                              farcasterIsConnected={effectiveIsConnected}
                            />
                            <StakeAllButton
                              tokenAddress={stake.tokenAddress}
                              stakingAddress={stake.stakingAddress}
                              stakingPoolAddress={stake.stakingPoolAddress}
                              symbol={stake.membership.pool.token.symbol}
                              tokenBalance={BigInt(
                                Math.floor(stake.baseAmount * 1e18)
                              )}
                              onSuccess={() =>
                                handleStakeSuccess(
                                  stake.tokenAddress,
                                  stake.stakingAddress
                                )
                              }
                              className="btn btn-secondary btn-sm"
                              isMiniApp={isMiniAppView}
                              farcasterAddress={effectiveAddress}
                              farcasterIsConnected={effectiveIsConnected}
                            />
                          </div>
                          <UnstakeButton
                            stakingAddress={stake.stakingAddress}
                            userStakedBalance={stake.stakedBalance}
                            symbol={stake.membership.pool.token.symbol}
                            onSuccess={() =>
                              handleStakeSuccess(
                                stake.tokenAddress,
                                stake.stakingAddress
                              )
                            }
                            className="btn btn-outline btn-sm w-full"
                            isMiniApp={isMiniAppView}
                            farcasterAddress={effectiveAddress}
                            farcasterIsConnected={effectiveIsConnected}
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
                {ownedSuperTokens.map((token, index) => (
                  <div
                    key={`token-${index}`}
                    className="card bg-base-100 border border-gray-200"
                  >
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          {/* Token Logo */}
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                            {token.logo ? (
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
                            ) : null}
                            <div
                              className={`${
                                token.logo ? "hidden" : ""
                              } w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold`}
                            >
                              {token.symbol.charAt(0)}
                            </div>
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
                              MKT CAP
                            </div>
                            <div className="flex gap-2 items-baseline">
                              <div className="font-mono text-sm font-bold">
                                {formatMarketCap(token.marketData?.marketCap)}
                              </div>
                              <div className="text-xs mt-1">
                                {format24hChange(
                                  token.marketData?.priceChange24h
                                )}
                              </div>
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
                                Math.floor(token.balance * 1e18)
                              )}
                              onSuccess={() =>
                                handleSuperTokenStakeSuccess(token.tokenAddress)
                              }
                              className="btn btn-primary btn-sm"
                              isMiniApp={isMiniAppView}
                              farcasterAddress={effectiveAddress}
                              farcasterIsConnected={effectiveIsConnected}
                            />
                            <StakeAllButton
                              tokenAddress={token.tokenAddress}
                              stakingAddress={token.stakingAddress}
                              stakingPoolAddress="" // Not needed for unstaked tokens
                              symbol={token.symbol}
                              tokenBalance={BigInt(
                                Math.floor(token.balance * 1e18)
                              )}
                              onSuccess={() =>
                                handleSuperTokenStakeSuccess(token.tokenAddress)
                              }
                              className="btn btn-secondary btn-sm"
                              isMiniApp={isMiniAppView}
                              farcasterAddress={effectiveAddress}
                              farcasterIsConnected={effectiveIsConnected}
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
