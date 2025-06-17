"use client";

import { useState } from "react";
import { useMissionContributors } from "@/src/hooks/useMissionContributors";
import { useStremePrice } from "@/src/hooks/useStremePrice";
import { formatUnits } from "viem";

interface MissionLeaderboardProps {
  missionId?: string; // If provided, show leaderboard for specific mission
  limit?: number; // Number of entries to show
}

export const MissionLeaderboard = ({ missionId, limit = 10 }: MissionLeaderboardProps) => {
  const [selectedTab, setSelectedTab] = useState<'all' | 'mission'>('all');
  const { contributors, loading, formatContribution } = useMissionContributors();
  const { formatUsd } = useStremePrice();

  const entries = contributors.slice(0, limit);

  const getUsdValue = (balance: bigint): string => {
    const stremeAmount = parseFloat(formatUnits(balance, 18));
    return formatUsd(stremeAmount);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${rank}`;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "text-yellow-500";
      case 2:
        return "text-gray-400";
      case 3:
        return "text-amber-600";
      default:
        return "text-base-content";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Selection for Mission-specific leaderboard */}
      {missionId && (
        <div className="tabs tabs-boxed">
          <button 
            className={`tab ${selectedTab === 'mission' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('mission')}
          >
            This Mission
          </button>
          <button 
            className={`tab ${selectedTab === 'all' ? 'tab-active' : ''}`}
            onClick={() => setSelectedTab('all')}
          >
            Global Leaderboard
          </button>
        </div>
      )}

      {/* Leaderboard Entries */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div 
            key={entry.address}
            className={`flex items-center justify-between p-4 rounded-lg transition-all duration-200 hover:bg-base-300/50 ${
              entry.rank <= 3 ? 'bg-base-300/30 border-l-4 border-primary' : 'bg-base-200/50'
            }`}
          >
            {/* Left Side - Rank and User Info */}
            <div className="flex items-center space-x-4">
              {/* Rank */}
              <div className={`text-2xl font-bold min-w-[3rem] text-center ${getRankColor(entry.rank)}`}>
                {getRankIcon(entry.rank)}
              </div>

              {/* User Avatar and Info */}
              <div className="flex items-center space-x-3">
                {entry.farcasterUser ? (
                  <div className="flex items-center space-x-3">
                    <div className="avatar">
                      <div className="w-10 h-10 rounded-full">
                        <img 
                          src={entry.farcasterUser.pfp_url || "/api/placeholder/40/40"} 
                          alt={entry.farcasterUser.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">{entry.farcasterUser.display_name}</div>
                      <div className="text-sm text-primary">@{entry.farcasterUser.username}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="avatar placeholder">
                      <div className="bg-neutral-focus text-neutral-content rounded-full w-10 h-10">
                        <span className="text-xs">
                          {entry.address.slice(2, 4).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-sm">
                        {entry.address ? `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}` : 'Unknown'}
                      </div>
                      <div className="text-xs text-base-content/70">Anonymous</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Contribution Stats */}
            <div className="text-right space-y-1">
              <div className="text-lg font-bold text-primary">
                {formatContribution(entry.balance)} STREME
              </div>
              <div className="text-sm text-accent font-medium">
                {getUsdValue(entry.balance)}
              </div>
              <div className="text-xs text-base-content/70">
                {entry.percentage.toFixed(1)}% of total
              </div>
              
              {/* Progress bar for percentage */}
              <div className="w-24 bg-base-300 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(entry.percentage * 2, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show More Button */}
      {entries.length >= limit && (
        <div className="text-center pt-4">
          <button className="btn btn-outline btn-primary">
            View Full Leaderboard
          </button>
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🏆</div>
          <h3 className="text-lg font-semibold mb-2">No Contributors Yet</h3>
          <p className="text-base-content/70">Be the first to contribute to this mission!</p>
        </div>
      )}
    </div>
  );
};