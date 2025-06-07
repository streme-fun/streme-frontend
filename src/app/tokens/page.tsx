"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "../../hooks/useAppFrameLogic";
import { formatUnits } from "viem";
import { StakeButton } from "../../components/StakeButton";
import { StakeAllButton } from "../../components/StakeAllButton";
import { UnstakeButton } from "../../components/UnstakeButton";
import { ConnectPoolButton } from "../../components/ConnectPoolButton";
import { TopUpAllStakesButton } from "../../components/TopUpAllStakesButton";
import { publicClient } from "../../lib/viemClient";
import { GDA_FORWARDER, GDA_ABI } from "../../lib/contracts";
import Link from "next/link";

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
].map((addr) => addr.toLowerCase());

export default function TokensPage() {
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
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  // Get effective address based on context
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;
  const effectiveIsConnected = isMiniAppView ? fcIsConnected : !!wagmiAddress;

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper function to fetch token data with caching
  const fetchTokenData = async (tokenAddress: string) => {
    // Don't make API calls for blacklisted tokens
    if (BLACKLISTED_TOKENS.includes(tokenAddress.toLowerCase())) {
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
      console.warn("Could not fetch token data for:", tokenAddress, error);
    }

    const fallbackData = {
      staking_address: undefined,
      logo: undefined,
      marketData: undefined,
    };
    tokenDataCache.set(tokenAddress, fallbackData);
    return fallbackData;
  };

  // Helper function to batch balance calls
  const fetchBalances = async (tokenAddresses: string[]) => {
    const balancePromises = tokenAddresses.map(async (tokenAddress) => {
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
        return { tokenAddress, balance };
      } catch (error) {
        console.warn("Failed to fetch balance for:", tokenAddress, error);
        return { tokenAddress, balance: BigInt(0) };
      }
    });

    return Promise.all(balancePromises);
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
      return connectedStatus;
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

  // Animation effect for streaming amounts
  useEffect(() => {
    if (stakes.length === 0) return;

    const interval = setInterval(() => {
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
    }, 50);

    return () => clearInterval(interval);
  }, [stakes.length > 0]);

  // Periodic balance refresh to keep streaming in sync
  useEffect(() => {
    if (!effectiveAddress || stakes.length === 0) return;

    const refreshBalances = async () => {
      try {
        const tokenAddresses = stakes.map((stake) => stake.tokenAddress);
        const balanceResults = await fetchBalances(tokenAddresses);
        const balanceMap = new Map(
          balanceResults.map((result) => [result.tokenAddress, result.balance])
        );

        setStakes((prevStakes) =>
          prevStakes.map((stake) => {
            const currentBalance =
              balanceMap.get(stake.tokenAddress) || BigInt(0);
            const formattedBalance = Number(formatUnits(currentBalance, 18));

            if (Math.abs(formattedBalance - stake.baseAmount) > 0.0001) {
              return {
                ...stake,
                receivedBalance: formattedBalance,
                baseAmount: formattedBalance,
                streamedAmount: 0,
                lastUpdateTime: Date.now(),
              };
            }
            return stake;
          })
        );
      } catch (error) {
        console.error("Error refreshing balances:", error);
      }
    };

    const refreshInterval = setInterval(refreshBalances, 30000);
    return () => clearInterval(refreshInterval);
  }, [effectiveAddress, stakes.length]);

  const fetchStakesAndTokens = async () => {
    if (!effectiveAddress) return;

    setLoading(true);
    setError(null);
    setAccountExists(null);

    try {
      const accountId = effectiveAddress.toLowerCase();

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
              const activeMemberships = accountData.poolMemberships.filter(
                (membership: PoolMembership) =>
                  membership.units &&
                  parseFloat(membership.units) > 0 &&
                  !membership.pool.token.isNativeAssetSuperToken &&
                  !BLACKLISTED_TOKENS.includes(
                    membership.pool.token.id.toLowerCase()
                  )
              );

              stakesData = await createInitialStakesData(activeMemberships);
              setStakes(stakesData);
              enhanceStakesWithApiData(stakesData);
            } else {
              setStakes([]);
            }

            // Process SuperTokens
            if (accountData.accountTokenSnapshots) {
              const initialSuperTokens = await createInitialSuperTokensData(
                accountData.accountTokenSnapshots,
                stakesData
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

    const tokenAddresses = memberships.map(
      (membership) => membership.pool.token.id
    );
    const balanceResults = await fetchBalances(tokenAddresses);
    const balanceMap = new Map(
      balanceResults.map((result) => [result.tokenAddress, result.balance])
    );

    for (const membership of memberships) {
      try {
        const tokenAddress = membership.pool.token.id;
        const receivedBalance = balanceMap.get(tokenAddress) || BigInt(0);
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

    return stakesData;
  };

  // Enhance stakes with API data
  const enhanceStakesWithApiData = async (initialStakes: StakeData[]) => {
    const tokenDataPromises = initialStakes.map((stake) =>
      fetchTokenData(stake.tokenAddress)
    );
    const tokenDataResults = await Promise.all(tokenDataPromises);

    const enhancedStakes = await Promise.all(
      initialStakes.map(async (stake, index) => {
        const tokenData = tokenDataResults[index];

        let isConnectedToPool = false;
        if (stake.stakingPoolAddress && effectiveAddress) {
          isConnectedToPool = await checkPoolConnection(
            stake.stakingPoolAddress,
            effectiveAddress
          );
        }

        let stakedBalance = BigInt(0);
        const stakingAddress = tokenData.staking_address;
        if (
          stakingAddress &&
          stakingAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          try {
            stakedBalance = await publicClient.readContract({
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
          }
        }

        return {
          ...stake,
          stakingAddress: stakingAddress || "",
          stakedBalance,
          logo: tokenData.logo,
          marketData: tokenData.marketData,
          isConnectedToPool,
        };
      })
    );

    setStakes(enhancedStakes);
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
        !BLACKLISTED_TOKENS.includes(snapshot.token.id.toLowerCase())
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
        const currentBalance = balanceMap.get(tokenAddress) || BigInt(0);
        const formattedBalance = Number(formatUnits(currentBalance, 18));

        const isAlreadyStaked = currentStakes.some(
          (stake) =>
            stake.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
        );

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

    return superTokensData;
  };

  // Enhance SuperTokens with API data
  const enhanceSuperTokensWithApiData = async (
    initialSuperTokens: SuperTokenData[]
  ) => {
    const tokenDataPromises = initialSuperTokens.map((token) =>
      fetchTokenData(token.tokenAddress)
    );
    const tokenDataResults = await Promise.all(tokenDataPromises);

    const enhancedSuperTokens = await Promise.all(
      initialSuperTokens.map(async (token, index) => {
        const tokenData = tokenDataResults[index];

        let isConnectedToPool = false;
        if (tokenData.staking_address && effectiveAddress) {
          const correspondingStake = stakes.find(
            (stake) =>
              stake.tokenAddress.toLowerCase() ===
              token.tokenAddress.toLowerCase()
          );
          if (correspondingStake?.stakingPoolAddress) {
            isConnectedToPool = await checkPoolConnection(
              correspondingStake.stakingPoolAddress,
              effectiveAddress
            );
          }
        }

        return {
          ...token,
          stakingAddress: tokenData.staking_address,
          logo: tokenData.logo,
          marketData: tokenData.marketData,
          isConnectedToPool,
        };
      })
    );

    setOwnedSuperTokens(enhancedSuperTokens);
  };

  // Helper functions for updates
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
              balanceMap.get(stake.tokenAddress) || BigInt(0);
            const formattedBalance = Number(formatUnits(currentBalance, 18));

            return {
              ...stake,
              receivedBalance: formattedBalance,
              baseAmount: formattedBalance,
              streamedAmount: 0,
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
              stakedBalance,
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
    if (tokenAddress) {
      updateStakeBalances([tokenAddress]);
      if (stakingAddress) {
        updateStakedBalance(stakingAddress, tokenAddress);
      }
    } else {
      updateStakeBalances();
    }
  };

  const handleConnectPoolSuccess = (
    poolAddress: string,
    tokenAddress: string
  ) => {
    updatePoolConnectionStatus(poolAddress, tokenAddress);
    updateStakeBalances([tokenAddress]);
  };

  const handleSuperTokenStakeSuccess = (tokenAddress: string) => {
    updateStakeBalances([tokenAddress]);
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
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                    onSuccess={() => handleStakeSuccess()}
                    className="btn btn-primary"
                    isMiniApp={isMiniAppView}
                    farcasterAddress={effectiveAddress}
                    farcasterIsConnected={effectiveIsConnected}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stakes.map((stake, index) => (
                    <div
                      key={`stake-${index}`}
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
                              MKT CAP
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
                            <div className="grid grid-cols-2 gap-2">
                              <StakeButton
                                tokenAddress={stake.tokenAddress}
                                stakingAddress={stake.stakingAddress}
                                stakingPoolAddress={stake.stakingPoolAddress}
                                symbol={stake.membership.pool.token.symbol}
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
                </div>
              </div>
            )}

            {/* Available SuperTokens Section */}
            {ownedSuperTokens.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Available to Stake</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ownedSuperTokens.map((token, index) => (
                    <div
                      key={`token-${index}`}
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
                              MKT CAP
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
                          <div className="pt-3">
                            <div className="grid grid-cols-2 gap-2">
                              <StakeButton
                                tokenAddress={token.tokenAddress}
                                stakingAddress={token.stakingAddress}
                                stakingPoolAddress=""
                                symbol={token.symbol}
                                onSuccess={() =>
                                  handleSuperTokenStakeSuccess(
                                    token.tokenAddress
                                  )
                                }
                                className="btn btn-primary btn-sm"
                                isMiniApp={isMiniAppView}
                                farcasterAddress={effectiveAddress}
                                farcasterIsConnected={effectiveIsConnected}
                              />
                              <StakeAllButton
                                tokenAddress={token.tokenAddress}
                                stakingAddress={token.stakingAddress}
                                stakingPoolAddress=""
                                symbol={token.symbol}
                                onSuccess={() =>
                                  handleSuperTokenStakeSuccess(
                                    token.tokenAddress
                                  )
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
