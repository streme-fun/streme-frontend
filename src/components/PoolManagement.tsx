"use client";

import { useState } from "react";
import { Address } from "viem";
import { BestFriend } from "@/src/lib/neynar";
import { getBestFriendAddress } from "@/src/lib/superfluid-pools";
import { PoolState } from "@/src/hooks/useDistributionPool";
import { toast } from "sonner";

interface PoolManagementProps {
  poolState: PoolState;
  poolAddress: Address | null;
  selectedFriends: BestFriend[];
  currentMemberIndex: number;
  totalMembers: number;
  onResetPool: () => void;
  onRemoveFriend?: (friendIndex: number) => void;
}

export function PoolManagement({
  poolState,
  poolAddress,
  selectedFriends,
  currentMemberIndex,
  totalMembers,
  onResetPool,
  onRemoveFriend,
}: PoolManagementProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleCopyPoolAddress = async () => {
    if (!poolAddress) return;
    
    try {
      await navigator.clipboard.writeText(poolAddress);
      toast.success("Pool address copied to clipboard");
    } catch (error) {
      console.error("Failed to copy pool address:", error);
      toast.error("Failed to copy pool address");
    }
  };

  const handleResetPool = () => {
    if (poolState === "ready" || poolState === "active" || poolState === "error") {
      const warningMessage = poolState === "active" 
        ? "Are you sure you want to reset the pool? This will stop the active stream and clear all selected friends. You'll need to create a new pool."
        : "Are you sure you want to reset the pool? This will clear all selected friends and you'll need to create a new pool.";
        
      const confirmed = window.confirm(warningMessage);
      if (confirmed) {
        onResetPool();
        toast.success("Pool reset successfully");
      }
    } else {
      onResetPool();
      toast.success("Pool reset successfully");
    }
  };

  if (poolState === "none") {
    return null;
  }

  return (
    <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Pool Management</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="btn btn-ghost btn-xs"
        >
          {showDetails ? "Hide" : "Show"} Details
        </button>
      </div>

      {/* Pool Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-sm text-base-content/70">Status:</div>
          <div className={`badge ${
            poolState === "ready" ? "badge-success" :
            poolState === "active" ? "badge-info" :
            poolState === "error" ? "badge-error" :
            poolState === "creating" || poolState === "adding_members" || poolState === "streaming" ? "badge-warning" :
            "badge-neutral"
          }`}>
            {poolState === "creating" ? "Creating Pool" :
             poolState === "adding_members" ? `Adding Members (${currentMemberIndex}/${totalMembers})` :
             poolState === "ready" ? "Ready" :
             poolState === "streaming" ? "Setting up Stream" :
             poolState === "active" ? "Streaming" :
             poolState === "error" ? "Error" :
             poolState}
          </div>
        </div>

        {poolAddress && (
          <div className="flex items-center gap-2">
            <div className="text-sm text-base-content/70">Pool Address:</div>
            <div className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
              {poolAddress.slice(0, 6)}...{poolAddress.slice(-4)}
            </div>
            <button
              onClick={handleCopyPoolAddress}
              className="btn btn-ghost btn-xs"
              title="Copy full address"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 20 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="space-y-4">
          {/* Selected Friends List */}
          <div>
            <div className="text-sm font-medium mb-2">Pool Members ({selectedFriends.length})</div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFriends.map((friend, index) => {
                const address = getBestFriendAddress(friend);
                const isProcessed = poolState === "adding_members" && index < currentMemberIndex;
                const isCurrentlyProcessing = poolState === "adding_members" && index === currentMemberIndex;
                const isPending = poolState === "adding_members" && index > currentMemberIndex;
                
                return (
                  <div
                    key={friend.fid}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      isProcessed ? "bg-success/10 border-success/20" :
                      isCurrentlyProcessing ? "bg-warning/10 border-warning/20" :
                      isPending ? "bg-base-200 border-base-300" :
                      "bg-base-200 border-base-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {friend.pfp_url && (
                        <img
                          src={friend.pfp_url}
                          alt={friend.display_name}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium">{friend.display_name}</div>
                        <div className="text-xs text-base-content/60">@{friend.username}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {address ? (
                        <div className="text-xs font-mono text-success">
                          {address.slice(0, 6)}...{address.slice(-4)}
                        </div>
                      ) : (
                        <div className="text-xs text-error">No address</div>
                      )}
                      
                      {isProcessed && (
                        <div className="badge badge-success badge-xs">Added</div>
                      )}
                      {isCurrentlyProcessing && (
                        <div className="badge badge-warning badge-xs">Adding...</div>
                      )}
                      {isPending && (
                        <div className="badge badge-neutral badge-xs">Pending</div>
                      )}
                      
                      {onRemoveFriend && poolState === "ready" && (
                        <button
                          onClick={() => onRemoveFriend(index)}
                          className="btn btn-ghost btn-xs text-error"
                          title="Remove from pool"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pool Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleResetPool}
              className="btn btn-error btn-sm"
              disabled={poolState === "creating" || poolState === "adding_members" || poolState === "streaming"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Reset Pool
            </button>

            {poolAddress && (
              <a
                href={`https://console.superfluid.finance/pool/${poolAddress}?tab=distributions`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on Console
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}