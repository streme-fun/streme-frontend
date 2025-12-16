"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { toast } from "sonner";

interface TokenStaker {
  address: string;
  units: string;
  percentage: number;
  isConnected: boolean;
  fid?: number;
  username?: string;
  pfp_url?: string | null;
}

interface StakerLeaderboardProps {
  stakingPoolAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StakerLeaderboard({
  tokenAddress,
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"units" | "address">("units");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch stakers data from Streme API
  const fetchStakers = async (bustCache = false) => {
    if (!tokenAddress) return;

    setLoading(true);
    setError(null);

    try {
      // Build URL with optional cache-busting parameter
      const url = `/api/token/${tokenAddress.toLowerCase()}/stakers${
        bustCache ? `?v=${Date.now()}` : ""
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch stakers: ${response.statusText}`);
      }

      const stakersData: TokenStaker[] = await response.json();

      console.log(`Fetched ${stakersData.length} stakers for token ${tokenAddress}`);

      setStakers(stakersData);
      setStakersWithFarcaster(stakersData); // Already enriched with Farcaster data
      setLoading(false);
    } catch (err) {
      console.error("Error fetching stakers:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch stakers");
      setStakers([]);
      setLoading(false);
    }
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchStakers(true); // Bust cache on manual refresh
      toast.success("Staker data refreshed!");
    } catch {
      toast.error("Failed to refresh staker data");
    } finally {
      setIsRefreshing(false);
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
          staker.address?.toLowerCase().includes(searchLower) ||
          (staker.username && staker.username.toLowerCase().includes(searchLower))
      );
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
          aValue = a.username || a.address;
          bValue = b.username || b.address;
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
    if (isOpen && tokenAddress) {
      fetchStakers();
    }
  }, [isOpen, tokenAddress]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">
              ${tokenSymbol} Staker Leaderboard
            </h3>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || loading}
              className="btn btn-ghost btn-sm"
              title="Refresh staker data"
            >
              {isRefreshing ? (
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
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by address or username..."
              className="input input-bordered w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
              <button onClick={() => fetchStakers()} className="btn btn-primary btn-sm">
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
                        Staker
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
                  </tr>
                </thead>
                <tbody>
                  {filteredStakers.map((staker, index) => (
                    <tr key={`${staker.address}-${index}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          {staker.pfp_url && (
                            <div className="avatar">
                              <div className="mask mask-squircle w-8 h-8">
                                <img
                                  src={staker.pfp_url}
                                  alt={staker.username || "User"}
                                />
                              </div>
                            </div>
                          )}
                          <div>
                            {staker.username && (
                              <a
                                href={`https://farcaster.xyz/${staker.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:text-primary hover:underline block"
                              >
                                @{staker.username}
                              </a>
                            )}
                            <a
                              href={`https://basescan.org/address/${staker.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary font-mono text-xs"
                            >
                              {staker.address
                                ? `${staker.address.slice(
                                    0,
                                    6
                                  )}...${staker.address.slice(-4)}`
                                : "Unknown"}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs">
                        {parseInt(staker.units).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredStakers.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={2}
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
