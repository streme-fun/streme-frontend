"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";

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

interface StakerLeaderboardProps {
  stakingPoolAddress: string;
  tokenSymbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StakerLeaderboard({
  stakingPoolAddress,
  tokenSymbol,
  isOpen,
  onClose,
}: StakerLeaderboardProps) {
  const [stakers, setStakers] = useState<TokenStaker[]>([]);
  const [stakersWithFarcaster, setStakersWithFarcaster] = useState<
    TokenStaker[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter and sort states
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
  const [sortBy, setSortBy] = useState<
    "units" | "address" | "status" | "joined"
  >("units");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch stakers data
  const fetchStakers = async () => {
    if (!stakingPoolAddress) return;

    setLoading(true);
    setError(null);

    const endpoints = [
      "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
      "https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-base",
    ];

    const query = `
      query GetPoolStakers($poolId: ID!, $first: Int!, $skip: Int!) {
        pool(id: $poolId) {
          id
          totalMembers
          poolMembers(first: $first, skip: $skip, orderBy: units, orderDirection: desc) {
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

    for (const endpoint of endpoints) {
      try {
        const allStakers: TokenStaker[] = [];
        const batchSize = 1000; // Fetch 1000 at a time
        let skip = 0;
        let hasMore = true;

        while (hasMore) {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              variables: {
                poolId: stakingPoolAddress.toLowerCase(),
                first: batchSize,
                skip: skip,
              },
            }),
          });

          if (!response.ok) break;

          const result = await response.json();

          if (result.errors) break;

          const poolData = result.data?.pool;
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

        // If we successfully got data from this endpoint, set it and enrich
        if (allStakers.length > 0) {
          console.log(
            `Fetched ${allStakers.length} stakers for pool ${stakingPoolAddress}`
          );
          setStakers(allStakers);
          setLoading(false); // Stop loading immediately after getting stakers

          // Start enriching with Farcaster data in the background
          enrichStakersWithFarcaster(allStakers);
        } else {
          setStakers([]);
          setLoading(false);
        }
        return; // Success, exit loop
      } catch (err) {
        console.warn(`Failed to fetch from ${endpoint}:`, err);
        continue;
      }
    }

    // If we get here, all endpoints failed
    setError("Failed to fetch stakers from all available endpoints");
    setLoading(false);
  };

  // Enrich stakers with Farcaster data
  const enrichStakersWithFarcaster = async (stakersData: TokenStaker[]) => {

    try {
      // Process in batches to avoid overwhelming the API
      const BATCH_SIZE = 50;
      const farcasterMap = new Map();
      
      for (let i = 0; i < stakersData.length; i += BATCH_SIZE) {
        const batch = stakersData.slice(i, i + BATCH_SIZE);
        const addresses = batch.map((staker) => staker.account.id);
        
        try {
          const response = await fetch("/api/neynar/bulk-users-by-address", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ addresses }),
          });

          if (!response.ok) {
            console.warn(`Failed to fetch Farcaster data for batch ${i / BATCH_SIZE + 1}`);
            continue;
          }

          const farcasterData = await response.json();
          
          // Handle the response format from neynar bulk users API
          Object.entries(farcasterData).forEach(
            ([address, users]: [string, unknown]) => {
              if (Array.isArray(users) && users.length > 0) {
                const user = users[0] as FarcasterUser; // Take the first user if multiple
                farcasterMap.set(address.toLowerCase(), {
                  fid: user.fid,
                  username: user.username,
                  display_name: user.display_name,
                  pfp_url: user.pfp_url,
                });
              }
            }
          );
        } catch (err) {
          console.warn(`Error fetching Farcaster data for batch ${i / BATCH_SIZE + 1}:`, err);
        }
      }

      // Update stakers with Farcaster data
      const enrichedStakers = stakersData.map((staker) => ({
        ...staker,
        farcasterUser: farcasterMap.get(staker.account.id.toLowerCase()),
      }));

      setStakersWithFarcaster(enrichedStakers);
    } catch (err) {
      console.error("Error enriching with Farcaster data:", err);
      setStakersWithFarcaster(stakersData); // Fallback to stakers without Farcaster data
    }
  };

  // Handle sorting
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("desc");
    }
  };

  // Filter and sort stakers
  const getFilteredAndSortedStakers = (stakersData: TokenStaker[]) => {
    let filtered = stakersData;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (staker) =>
          staker.account.id.toLowerCase().includes(searchLower) ||
          (staker.farcasterUser?.username &&
            staker.farcasterUser.username.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((staker) => {
        const hasUnits = parseInt(staker.units) > 0;
        if (filterType === "stakers") return hasUnits;
        if (filterType === "holders") return !hasUnits;
        return true;
      });
    }

    // Apply Farcaster filter
    if (filterFarcaster !== "all") {
      filtered = filtered.filter((staker) => {
        const hasFarcaster = !!staker.farcasterUser;
        if (filterFarcaster === "with") return hasFarcaster;
        if (filterFarcaster === "without") return !hasFarcaster;
        return true;
      });
    }

    // Apply connection filter
    if (filterConnection !== "all") {
      filtered = filtered.filter((staker) => {
        if (filterConnection === "connected") return staker.isConnected;
        if (filterConnection === "not_connected") return !staker.isConnected;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "units":
          aValue = parseInt(a.units);
          bValue = parseInt(b.units);
          break;
        case "address":
          aValue = a.farcasterUser?.username || a.account.id;
          bValue = b.farcasterUser?.username || b.account.id;
          break;
        case "status":
          aValue = a.isConnected ? "connected" : "not_connected";
          bValue = b.isConnected ? "connected" : "not_connected";
          break;
        case "joined":
          aValue = parseInt(a.createdAtTimestamp);
          bValue = parseInt(b.createdAtTimestamp);
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return filtered;
  };

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen && stakingPoolAddress) {
      fetchStakers();
    }
  }, [isOpen, stakingPoolAddress]);

  // Reset filters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setFilterType("all");
      setFilterFarcaster("all");
      setFilterConnection("all");
      setStakers([]);
      setStakersWithFarcaster(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayStakers = stakersWithFarcaster || stakers;
  const filteredStakers = getFilteredAndSortedStakers(displayStakers);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col max-h-[90vh] md:max-h-[80vh]">
        {/* Header */}
        <div className="p-6 pb-0">
          <h3 className="text-xl font-bold mb-4">
            ${tokenSymbol} Staker Leaderboard
          </h3>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6">
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
                  className="select select-bordered select-sm"
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
                  className="select select-bordered select-sm"
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
                  className="select select-bordered select-sm"
                  value={filterConnection}
                  onChange={(e) =>
                    setFilterConnection(
                      e.target.value as "all" | "connected" | "not_connected"
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
                  className="btn btn-outline btn-sm"
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
          <div className="mb-4 text-sm text-base-content/70">
            Showing top {stakers.length} stakers
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-error mb-4">{error}</p>
              <button onClick={fetchStakers} className="btn btn-primary btn-sm">
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleSort("address")}
                    >
                      <div className="flex items-center gap-2">
                        Staker / Farcaster
                        {sortBy === "address" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleSort("units")}
                    >
                      <div className="flex items-center gap-2">
                        Staked Balance
                        {sortBy === "units" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {sortBy === "status" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleSort("joined")}
                    >
                      <div className="flex items-center gap-2">
                        Joined
                        {sortBy === "joined" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStakers.map((staker, index) => (
                    <tr key={`${staker.account.id}-${index}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          {staker.farcasterUser?.pfp_url && (
                            <div className="avatar">
                              <div className="mask mask-squircle w-8 h-8">
                                <img
                                  src={staker.farcasterUser.pfp_url}
                                  alt={staker.farcasterUser.username || "User"}
                                />
                              </div>
                            </div>
                          )}
                          <div>
                            <a
                              href={`https://basescan.org/address/${staker.account.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary font-mono text-xs"
                            >
                              {staker.account.id
                                ? `${staker.account.id.slice(
                                    0,
                                    6
                                  )}...${staker.account.id.slice(-4)}`
                                : "Unknown"}
                            </a>
                            {staker.farcasterUser?.username && (
                              <div className="text-xs text-base-content/70">
                                @{staker.farcasterUser.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs">
                        {parseInt(staker.units).toLocaleString()}
                      </td>
                      <td>
                        <div
                          className={`badge badge-xs ${
                            staker.isConnected
                              ? "badge-success"
                              : "badge-warning"
                          }`}
                        >
                          {staker.isConnected ? "Connected" : "Not Connected"}
                        </div>
                      </td>
                      <td className="text-xs text-base-content/60">
                        {new Date(
                          parseInt(staker.createdAtTimestamp) * 1000
                        ).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {filteredStakers.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center text-base-content/50"
                      >
                        No stakers found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-base-300">
          <button className="btn btn-sm btn-outline w-full" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
