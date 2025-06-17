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
  tokenAddress: string;
  tokenSymbol: string;
  onViewAll: () => void;
}

export function StakerLeaderboardEmbed({
  tokenAddress,
  tokenSymbol,
  onViewAll,
}: StakerLeaderboardEmbedProps) {
  const [stakers, setStakers] = useState<TokenStaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopStakers = async () => {
    if (!tokenAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Use the internal API route
      const response = await fetch(
        `/api/token/${tokenAddress}/stakers`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch stakers: ${response.status}`);
      }

      const data = await response.json();
      
      // Debug: Log the first staker to understand data structure
      if (data && data.length > 0) {
        console.log('Sample staker data structure:', JSON.stringify(data[0], null, 2));
      }
      
      // Define interface for raw API staker data
      interface RawStakerData {
        // Legacy field names (for backward compatibility)
        account?: string;
        address?: string;
        units?: string;
        balance?: string;
        farcasterUser?: FarcasterUser;
        
        // Current API field names
        holder_address?: string;
        staked_balance?: number;
        farcaster?: {
          fid: number;
          username: string;
          pfp_url: string;
        };
        
        // Common fields
        isConnected?: boolean;
        createdAtTimestamp?: string;
        timestamp?: string;
        fid?: number;
        username?: string;
        display_name?: string;
        pfp_url?: string;
        profileImage?: string;
      }

      // Transform and get only top 10 stakers
      const transformedStakers: TokenStaker[] = data
        .slice(0, 10)
        .map((staker: RawStakerData) => ({
          account: {
            id: staker.holder_address || staker.account || staker.address || "",
          },
          units: staker.staked_balance 
            ? Math.floor(staker.staked_balance).toString()
            : (staker.units || staker.balance || "0"),
          isConnected: staker.isConnected ?? true,
          createdAtTimestamp: staker.createdAtTimestamp || staker.timestamp || "0",
          farcasterUser: staker.farcaster ? {
            fid: staker.farcaster.fid,
            username: staker.farcaster.username,
            display_name: staker.farcaster.username, // Use username as display_name if not provided
            pfp_url: staker.farcaster.pfp_url,
          } : (staker.farcasterUser || (staker.username ? {
            fid: staker.fid || 0,
            username: staker.username,
            display_name: staker.display_name || staker.username,
            pfp_url: staker.pfp_url || staker.profileImage || "",
          } : undefined)),
        }));
        
      setStakers(transformedStakers);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch stakers:", err);
      setError("Failed to fetch stakers");
      setLoading(false);
    }
  };


  useEffect(() => {
    if (tokenAddress) {
      fetchTopStakers();
    }
  }, [tokenAddress]);

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
                        {staker.account.id ? `${staker.account.id.slice(0, 6)}...${staker.account.id.slice(-4)}` : 'Unknown'}
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