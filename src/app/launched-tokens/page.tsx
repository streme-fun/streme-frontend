"use client";

import { useState, useEffect } from "react";
import { LaunchedToken } from "@/src/app/types";
import { ClaimFeesButton } from "@/src/components/ClaimFeesButton";

interface TokenStaker {
  account: {
    id: string;
  };
  units: string;
  isConnected: boolean;
  createdAtTimestamp: string;
  farcasterUser?: FarcasterUser;
}

interface FarcasterUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

interface EnrichedLaunchedToken extends LaunchedToken {
  totalStakers?: number;
  totalStaked?: number;
  stakers?: TokenStaker[];
  claimableFees?: {
    amount0: number;
    amount1: number;
    token0: string;
    token1: string;
  };
  totalFees?: {
    feeGrowthGlobal0: number;
    feeGrowthGlobal1: number;
  };
}

export default function LaunchedTokensPage() {
  const deployerAddress = "0x0C65BE17E86BCB6019148be0a4E8F0A4510A70CB"; // Hardcoded for debugging
  const [tokens, setTokens] = useState<EnrichedLaunchedToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTokenStakers, setSelectedTokenStakers] = useState<{
    token: EnrichedLaunchedToken;
    isOpen: boolean;
  } | null>(null);
  const [stakersSortBy, setStakersSortBy] = useState<
    "units" | "address" | "status" | "joined"
  >("units");
  const [stakersSortDirection, setStakersSortDirection] = useState<
    "asc" | "desc"
  >("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "stakers" | "holders">(
    "all"
  );
  const [filterFarcaster, setFilterFarcaster] = useState<
    "all" | "with" | "without"
  >("all");
  const [filterConnection, setFilterConnection] = useState<
    "all" | "connected" | "not_connected"
  >("all");

  // Automatically fetch tokens on component mount
  useEffect(() => {
    fetchLaunchedTokens();
  }, []);

  const fetchLaunchedTokens = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tokens/deployer/${deployerAddress}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch tokens");
      }

      const enrichedTokens = await enrichTokensWithStakingData(result.data);
      setTokens(enrichedTokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenStakers = async (
    stakingPoolId: string
  ): Promise<TokenStaker[]> => {
    const query = `
      query GetPoolStakers($poolId: ID!, $first: Int!, $skip: Int!) {
        pool(id: $poolId) {
          poolMembers(first: $first, skip: $skip, orderBy: createdAtTimestamp, orderDirection: desc) {
            account {
              id
            }
            units
            isConnected
            createdAtTimestamp
          }
        }
      }
    `;

    const endpoints = [
      "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
      "https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-base",
    ];

    let allStakers: TokenStaker[] = [];
    const batchSize = 1000; // Fetch 1000 at a time
    let skip = 0;
    let hasMore = true;

    for (const endpoint of endpoints) {
      try {
        // Reset for each endpoint attempt
        allStakers = [];
        skip = 0;
        hasMore = true;

        while (hasMore) {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              variables: {
                poolId: stakingPoolId,
                first: batchSize,
                skip: skip,
              },
            }),
          });

          if (!response.ok) break;

          const data = await response.json();
          if (data.errors) break;

          const poolData = data.data?.pool;
          if (!poolData) break;

          const batch = poolData.poolMembers || [];
          allStakers.push(...batch);

          // If we got less than the batch size, we've reached the end
          if (batch.length < batchSize) {
            hasMore = false;
          } else {
            skip += batchSize;
          }
        }

        // If we successfully got data from this endpoint, return it
        if (allStakers.length > 0) {
          console.log(
            `Fetched ${allStakers.length} stakers for pool ${stakingPoolId}`
          );
          return allStakers;
        }
      } catch (err) {
        console.warn(`Failed to fetch stakers from ${endpoint}:`, err);
        continue;
      }
    }

    return allStakers;
  };

  const fetchFarcasterUsersByAddresses = async (
    addresses: string[]
  ): Promise<Record<string, FarcasterUser>> => {
    if (addresses.length === 0) return {};

    console.log(`Fetching Farcaster users for ${addresses.length} addresses`);

    try {
      const response = await fetch("/api/neynar/bulk-users-by-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });

      if (!response.ok) {
        console.warn(
          "Failed to fetch Farcaster users:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.warn("Error response:", errorText);
        return {};
      }

      const data = await response.json();
      console.log("Neynar API response:", data);

      // Create a map of address -> user data
      const userMap: Record<string, FarcasterUser> = {};

      // The Neynar API returns data directly as an object mapping addresses to user arrays
      Object.entries(data as Record<string, FarcasterUser[]>).forEach(
        ([address, userData]) => {
          if (userData && Array.isArray(userData) && userData.length > 0) {
            // Take the first user if multiple users have the same address
            userMap[address.toLowerCase()] = userData[0];
            console.log(
              `Found Farcaster user for ${address}:`,
              userData[0].username
            );
          }
        }
      );

      console.log(`Mapped ${Object.keys(userMap).length} Farcaster users`);
      return userMap;
    } catch (error) {
      console.warn("Error fetching Farcaster users:", error);
      return {};
    }
  };

  const enrichTokensWithStakingData = async (
    tokenList: LaunchedToken[]
  ): Promise<EnrichedLaunchedToken[]> => {
    const enrichmentPromises = tokenList.map(async (token) => {
      try {
        const stakers = await fetchTokenStakers(token.staking_pool);

        // Fetch Farcaster users for the staker addresses
        const addresses = stakers.map((staker) => staker.account.id);
        const farcasterUsers = await fetchFarcasterUsersByAddresses(addresses);

        // Enrich stakers with Farcaster user data
        const enrichedStakers = stakers.map((staker) => {
          const farcasterUser = farcasterUsers[staker.account.id.toLowerCase()];
          if (farcasterUser) {
            console.log(
              `Enriching staker ${staker.account.id} with Farcaster user:`,
              farcasterUser.username
            );
          }
          return {
            ...staker,
            farcasterUser,
          };
        });

        const totalStaked = stakers.reduce(
          (sum, staker) => sum + parseInt(staker.units),
          0
        );

        // Fetch claimable fees
        let claimableFees = undefined;
        try {
          const res = await fetch(
            `/api/token/${token.contract_address}/claimable-fees`
          );
          if (res.ok) {
            const data = await res.json();
            claimableFees = {
              amount0: data.amount0,
              amount1: data.amount1,
              token0: data.token0,
              token1: data.token1,
            };
          }
        } catch {}
        // Fetch total fees (requires pool_address)
        let totalFees = undefined;
        if (token.pool_address) {
          try {
            const res = await fetch(
              `/api/token/${token.contract_address}/total-fees?pool=${token.pool_address}`
            );
            if (res.ok) {
              const data = await res.json();
              totalFees = {
                feeGrowthGlobal0: data.feeGrowthGlobal0,
                feeGrowthGlobal1: data.feeGrowthGlobal1,
              };
            }
          } catch {}
        }

        return {
          ...token,
          totalStakers: stakers.length,
          totalStaked,
          stakers: enrichedStakers,
          claimableFees,
          totalFees,
        };
      } catch (err) {
        console.warn(`Failed to enrich token ${token.contract_address}:`, err);
        return {
          ...token,
          totalStakers: 0,
          totalStaked: 0,
          stakers: [],
        };
      }
    });

    return Promise.all(enrichmentPromises);
  };

  const formatPrice = (price: number | undefined) => {
    if (!price || isNaN(price)) return "-";

    if (price < 0.01 && price > 0) {
      const decimalStr = price.toFixed(20).split(".")[1];
      let zeroCount = 0;
      while (decimalStr[zeroCount] === "0") {
        zeroCount++;
      }

      return (
        <span className="whitespace-nowrap">
          $0.0{zeroCount > 0 && <sub>{zeroCount}</sub>}
          {decimalStr.slice(zeroCount, zeroCount + 4)}
        </span>
      );
    }

    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    })}`;
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`;
    } else if (marketCap >= 1000) {
      return `$${(marketCap / 1000).toFixed(2)}K`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    const color = value >= 0 ? "text-green-500" : "text-red-500";
    const sign = value >= 0 ? "+" : "";
    return (
      <span className={color}>
        {sign}
        {value.toFixed(2)}%
      </span>
    );
  };

  const formatDate = (timestamp: { _seconds: number }) => {
    return new Date(timestamp._seconds * 1000).toLocaleDateString();
  };

  const handleStakersSort = (
    column: "units" | "address" | "status" | "joined"
  ) => {
    if (stakersSortBy === column) {
      // Toggle direction if same column
      setStakersSortDirection(stakersSortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, set default direction
      setStakersSortBy(column);
      setStakersSortDirection(column === "units" ? "desc" : "asc"); // Units default to desc (largest first)
    }
  };

  const getFilteredAndSortedStakers = (stakers: TokenStaker[]) => {
    return [...stakers]
      .filter((staker) => staker && staker.account?.id) // Filter out invalid stakers
      .filter((staker) => {
        // Search filter
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const addressMatch = staker.account.id
            ?.toLowerCase()
            .includes(searchLower);
          const usernameMatch = staker.farcasterUser?.username
            ?.toLowerCase()
            .includes(searchLower);
          if (!addressMatch && !usernameMatch) return false;
        }

        // Type filter - all are stakers in this context
        if (filterType === "holders") return false; // No pure holders in stakers list

        // Farcaster filter
        if (filterFarcaster === "with" && !staker.farcasterUser) return false;
        if (filterFarcaster === "without" && staker.farcasterUser) return false;

        // Connection status filter
        if (filterConnection === "connected" && !staker.isConnected)
          return false;
        if (filterConnection === "not_connected" && staker.isConnected)
          return false;

        return true;
      })
      .sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (stakersSortBy) {
          case "units":
            aValue = parseInt(a.units) || 0;
            bValue = parseInt(b.units) || 0;
            break;
          case "address":
            aValue = (a.account.id || "").toLowerCase();
            bValue = (b.account.id || "").toLowerCase();
            break;
          case "status":
            aValue = a.isConnected ? 1 : 0;
            bValue = b.isConnected ? 1 : 0;
            break;
          case "joined":
            aValue = parseInt(a.createdAtTimestamp) || 0;
            bValue = parseInt(b.createdAtTimestamp) || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return stakersSortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return stakersSortDirection === "asc" ? 1 : -1;
        return 0;
      });
  };

  // Helper to format fee values safely
  const formatFeeValue = (value: unknown, symbol?: string) => {
    const num = typeof value === "number" ? value : Number(value);
    if (value === null || value === undefined || isNaN(num)) return "-";
    return `${num.toFixed(6)}${symbol ? " " + symbol.slice(0, 6) : ""}`;
  };

  return (
    <div className="min-h-screen bg-base-200 py-8 mt-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Launched Tokens</h1>
          <p className="mb-6 opacity-70">
            Tokens launched by:{" "}
            <span className="font-mono">{deployerAddress}</span>
          </p>

          {error && (
            <div className="alert alert-error mb-6">
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
          )}
        </div>

        {tokens.length > 0 && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-xl mb-4">
                {tokens.length} Token{tokens.length !== 1 ? "s" : ""} Found
              </h2>

              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Price</th>
                      <th>Market Cap</th>
                      <th>24h Change</th>
                      <th>Volume 24h</th>
                      <th>Stakers</th>
                      <th>Claimable Fees</th>
                      <th>Total Fees Generated</th>
                      <th>Created</th>
                      <th>Contract</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token) => (
                      <tr key={token.contract_address} className="hover">
                        <td>
                          <div className="flex items-center gap-3">
                            {token.img_url && (
                              <div className="avatar">
                                <div className="mask mask-squircle w-12 h-12">
                                  <img src={token.img_url} alt={token.name} />
                                </div>
                              </div>
                            )}
                            <div>
                              <a
                                href={`/token/${token.contract_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link link-hover"
                              >
                                <div className="font-bold">{token.name}</div>
                                <div className="text-sm opacity-50">
                                  ${token.symbol}
                                </div>
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="font-mono">
                          {formatPrice(token.marketData.price)}
                        </td>
                        <td className="font-mono">
                          {formatMarketCap(token.marketData.marketCap)}
                        </td>
                        <td>
                          {formatPercentage(token.marketData.priceChange24h)}
                        </td>
                        <td className="font-mono">
                          {token.marketData.volume24h
                            ? formatMarketCap(token.marketData.volume24h)
                            : "N/A"}
                        </td>
                        <td className="text-center">
                          <button
                            className="badge badge-outline hover:badge-primary cursor-pointer"
                            onClick={() =>
                              setSelectedTokenStakers({
                                token,
                                isOpen: true,
                              })
                            }
                            disabled={
                              !token.stakers || token.stakers.length === 0
                            }
                          >
                            {token.totalStakers ?? 0}
                          </button>
                        </td>
                        <td className="font-mono">
                          {token.claimableFees ? (
                            <div className="flex flex-col gap-1">
                              <span>
                                {formatFeeValue(token.claimableFees.amount0)}
                                <span className="ml-1 text-xs opacity-70">
                                  {token.symbol}
                                </span>
                              </span>
                              <span>
                                {formatFeeValue(token.claimableFees.amount1)}
                                <span className="ml-1 text-xs opacity-70">
                                  WETH
                                </span>
                              </span>
                            </div>
                          ) : (
                            <span title="No claimable fees data available">
                              -
                            </span>
                          )}
                        </td>
                        <td className="font-mono">
                          {token.totalFees ? (
                            <div className="flex flex-col gap-1">
                              <span>
                                {formatFeeValue(
                                  token.totalFees.feeGrowthGlobal0
                                )}
                                <span className="ml-1 text-xs opacity-70">
                                  {token.symbol}
                                </span>
                              </span>
                              <span>
                                {formatFeeValue(
                                  token.totalFees.feeGrowthGlobal1
                                )}
                                <span className="ml-1 text-xs opacity-70">
                                  WETH
                                </span>
                              </span>
                            </div>
                          ) : token.pool_address ? (
                            <span title="No total fees data available">-</span>
                          ) : (
                            <span title="Missing pool address">-</span>
                          )}
                        </td>
                        <td className="opacity-50">
                          {formatDate(token.timestamp)}
                        </td>
                        <td>
                          <a
                            href={`https://basescan.org/address/${token.contract_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link link-primary"
                          >
                            {token.contract_address.slice(0, 6)}...
                            {token.contract_address.slice(-4)}
                          </a>
                        </td>
                        <td>
                          <ClaimFeesButton
                            tokenAddress={token.contract_address}
                            creatorAddress={token.deployer}
                            className="btn btn-sm btn-outline btn-secondary"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tokens.length === 0 && !loading && !error && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body text-center">
              <div className="opacity-60">
                No tokens found for this deployer address
              </div>
            </div>
          </div>
        )}

        {/* Stakers Modal */}
        {selectedTokenStakers && (
          <div className="modal modal-open">
            <div className="modal-box max-w-4xl">
              <h3 className="font-bold text-lg mb-4">
                {selectedTokenStakers.token.name} ($
                {selectedTokenStakers.token.symbol}) Stakers
              </h3>

              {/* Search and Filters */}
              <div className="mb-4 space-y-4">
                {/* Search Input */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">
                      Search by address or username
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search address or Farcaster username..."
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Type</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={filterType}
                      onChange={(e) =>
                        setFilterType(
                          e.target.value as "all" | "stakers" | "holders"
                        )
                      }
                    >
                      <option value="all">All</option>
                      <option value="stakers">Stakers Only</option>
                      <option value="holders">Holders Only</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Farcaster</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={filterFarcaster}
                      onChange={(e) =>
                        setFilterFarcaster(
                          e.target.value as "all" | "with" | "without"
                        )
                      }
                    >
                      <option value="all">All</option>
                      <option value="with">With Farcaster</option>
                      <option value="without">Without Farcaster</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Connection</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={filterConnection}
                      onChange={(e) =>
                        setFilterConnection(
                          e.target.value as
                            | "all"
                            | "connected"
                            | "not_connected"
                        )
                      }
                    >
                      <option value="all">All</option>
                      <option value="connected">Connected</option>
                      <option value="not_connected">Not Connected</option>
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">&nbsp;</span>
                    </label>
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        setSearchTerm("");
                        setFilterType("all");
                        setFilterFarcaster("all");
                        setFilterConnection("all");
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Results Counter */}
              <div className="mb-2 text-sm opacity-70">
                Showing{" "}
                {selectedTokenStakers.token.stakers
                  ? getFilteredAndSortedStakers(
                      selectedTokenStakers.token.stakers
                    ).length
                  : 0}{" "}
                of {selectedTokenStakers.token.stakers?.length || 0} holders
              </div>

              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th
                        className="cursor-pointer select-none hover:bg-base-200"
                        onClick={() => handleStakersSort("address")}
                      >
                        <div className="flex items-center gap-2">
                          Holder / Farcaster
                          {stakersSortBy === "address" && (
                            <span className="text-primary">
                              {stakersSortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer select-none hover:bg-base-200"
                        onClick={() => handleStakersSort("units")}
                      >
                        <div className="flex items-center gap-2">
                          Staked Balance
                          {stakersSortBy === "units" && (
                            <span className="text-primary">
                              {stakersSortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer select-none hover:bg-base-200"
                        onClick={() => handleStakersSort("status")}
                      >
                        <div className="flex items-center gap-2">
                          Type
                          {stakersSortBy === "status" && (
                            <span className="text-primary">
                              {stakersSortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer select-none hover:bg-base-200"
                        onClick={() => handleStakersSort("joined")}
                      >
                        <div className="flex items-center gap-2">
                          Last Updated
                          {stakersSortBy === "joined" && (
                            <span className="text-primary">
                              {stakersSortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTokenStakers.token.stakers
                      ? getFilteredAndSortedStakers(
                          selectedTokenStakers.token.stakers
                        )
                      : []
                    ).map((staker, index) => (
                      <tr key={`${staker.account.id}-${index}`}>
                        <td>
                          <div className="flex items-center gap-3">
                            {staker.farcasterUser &&
                              staker.farcasterUser.pfp_url && (
                                <div className="avatar">
                                  <div className="mask mask-squircle w-8 h-8">
                                    <img
                                      src={staker.farcasterUser.pfp_url}
                                      alt={
                                        staker.farcasterUser.username || "User"
                                      }
                                    />
                                  </div>
                                </div>
                              )}
                            <div>
                              <a
                                href={`https://basescan.org/address/${staker.account.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link link-primary font-mono"
                              >
                                {staker.account.id.slice(0, 6)}...
                                {staker.account.id.slice(-4)}
                              </a>
                              {staker.farcasterUser &&
                                staker.farcasterUser.username && (
                                  <div className="text-sm opacity-70">
                                    @{staker.farcasterUser.username}
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="font-mono">
                          {parseInt(staker.units).toLocaleString()} units
                        </td>
                        <td>
                          <div
                            className={`badge ${
                              staker.isConnected
                                ? "badge-success"
                                : "badge-warning"
                            }`}
                          >
                            {staker.isConnected ? "Connected" : "Not Connected"}
                          </div>
                        </td>
                        <td className="opacity-50">
                          {new Date(
                            parseInt(staker.createdAtTimestamp) * 1000
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={4} className="text-center opacity-50">
                          No holders found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="modal-action">
                <button
                  className="btn"
                  onClick={() => {
                    setSelectedTokenStakers(null);
                    // Reset filters when closing modal
                    setSearchTerm("");
                    setFilterType("all");
                    setFilterFarcaster("all");
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div
              className="modal-backdrop"
              onClick={() => {
                setSelectedTokenStakers(null);
                // Reset filters when closing modal
                setSearchTerm("");
                setFilterType("all");
                setFilterFarcaster("all");
              }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}
