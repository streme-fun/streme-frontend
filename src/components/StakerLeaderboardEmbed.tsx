"use client";

import { useState, useEffect } from "react";

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

interface StakerLeaderboardEmbedProps {
  stakingPoolAddress: string;
  tokenSymbol: string;
  onViewAll: () => void;
}

export function StakerLeaderboardEmbed({
  stakingPoolAddress,
  tokenSymbol,
  onViewAll,
}: StakerLeaderboardEmbedProps) {
  const [stakers, setStakers] = useState<TokenStaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopStakers = async () => {
    if (!stakingPoolAddress) return;
    
    setLoading(true);
    setError(null);
    
    const endpoints = [
      "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
      "https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-base",
    ];

    const query = `
      query GetTopStakers($poolId: ID!) {
        pool(id: $poolId) {
          id
          totalMembers
          poolMembers(first: 10, orderBy: units, orderDirection: desc) {
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
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables: {
              poolId: stakingPoolAddress.toLowerCase(),
            },
          }),
        });

        if (!response.ok) continue;

        const result = await response.json();
        
        if (result.errors) continue;

        const poolData = result.data?.pool;
        if (!poolData) continue;

        const stakersData = poolData.poolMembers || [];
        
        // Set stakers immediately without waiting for Farcaster
        setStakers(stakersData);
        setLoading(false);
        
        // Enrich with Farcaster data in the background
        if (stakersData.length > 0) {
          enrichStakersWithFarcaster(stakersData).then(enrichedStakers => {
            setStakers(enrichedStakers);
          });
        }
        return; // Success, exit loop
      } catch (err) {
        console.warn(`Failed to fetch from ${endpoint}:`, err);
        continue;
      }
    }
    
    // If we get here, all endpoints failed
    setError("Failed to fetch stakers");
    setLoading(false);
  };

  const enrichStakersWithFarcaster = async (stakersData: TokenStaker[]): Promise<TokenStaker[]> => {
    try {
      const addresses = stakersData.map(staker => staker.account.id);
      const response = await fetch("/api/neynar/bulk-users-by-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addresses }),
      });

      if (!response.ok) {
        return stakersData; // Return without Farcaster data if API fails
      }

      const farcasterData = await response.json();
      const farcasterMap = new Map();
      
      // Handle the response format from neynar bulk users API
      Object.entries(farcasterData).forEach(([address, users]: [string, unknown]) => {
        if (Array.isArray(users) && users.length > 0) {
          const user = users[0] as FarcasterUser; // Take the first user if multiple
          farcasterMap.set(address.toLowerCase(), {
            fid: user.fid,
            username: user.username,
            display_name: user.display_name,
            pfp_url: user.pfp_url,
          });
        }
      });

      return stakersData.map(staker => ({
        ...staker,
        farcasterUser: farcasterMap.get(staker.account.id.toLowerCase()),
      }));
    } catch (err) {
      console.error("Error enriching with Farcaster data:", err);
      return stakersData; // Return without Farcaster data if enrichment fails
    }
  };

  useEffect(() => {
    if (stakingPoolAddress) {
      fetchTopStakers();
    }
  }, [stakingPoolAddress]);

  if (loading) {
    return (
      <div className="card bg-base-100 border-base-300 border-2 p-4">
        <h3 className="text-lg font-bold mb-4">Top Stakers</h3>
        <div className="flex justify-center items-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-base-100 border-base-300 border-2 p-4">
        <h3 className="text-lg font-bold mb-4">Top Stakers</h3>
        <div className="text-center py-4">
          <p className="text-error text-sm mb-2">{error}</p>
          <button onClick={fetchTopStakers} className="btn btn-primary btn-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 border-base-300 border-2 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Top ${tokenSymbol} Stakers</h3>
        {stakers.length > 0 && (
          <button
            onClick={onViewAll}
            className="btn btn-outline btn-sm"
          >
            View All
          </button>
        )}
      </div>
      
      {stakers.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-base-content/50 text-sm">No stakers yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stakers.map((staker, index) => (
            <div
              key={`${staker.account.id}-${index}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 transition-colors"
            >
              {/* Rank */}
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {index + 1}
              </div>

              {/* Profile */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {staker.farcasterUser?.pfp_url && (
                  <div className="avatar">
                    <div className="mask mask-squircle w-6 h-6">
                      <img
                        src={staker.farcasterUser.pfp_url}
                        alt={staker.farcasterUser.username || "User"}
                      />
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {staker.farcasterUser?.username ? (
                    <div className="text-sm font-medium">
                      @{staker.farcasterUser.username}
                    </div>
                  ) : (
                    <div className="font-mono text-xs text-primary">
                      <a
                        href={`https://basescan.org/address/${staker.account.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {staker.account.id.slice(0, 6)}...{staker.account.id.slice(-4)}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Staked Amount */}
              <div className="text-right">
                <div className="font-mono text-sm font-medium">
                  {parseInt(staker.units).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}