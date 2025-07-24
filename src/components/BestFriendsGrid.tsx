"use client";

import { useState, useEffect } from "react";
import SafeImage from "./SafeImage";
import { BestFriend } from "@/src/lib/neynar";

interface BestFriendsGridProps {
  userFid: number;
  onSelectionChange: (selectedFriends: BestFriend[]) => void;
  maxSelection?: number;
}

export function BestFriendsGrid({ 
  userFid, 
  onSelectionChange, 
  maxSelection = 10 
}: BestFriendsGridProps) {
  const [friends, setFriends] = useState<BestFriend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBestFriends = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/neynar/best-friends/${userFid}?limit=${maxSelection}`);
        const data = await response.json();
        
        if (data.success) {
          setFriends(data.data.friends);
        } else {
          setError("Failed to load best friends");
        }
      } catch (err) {
        console.error("Error fetching best friends:", err);
        setError("Failed to load best friends");
      } finally {
        setIsLoading(false);
      }
    };

    if (userFid) {
      fetchBestFriends();
    }
  }, [userFid, maxSelection]);

  const toggleFriendSelection = (friend: BestFriend) => {
    const newSelected = new Set(selectedFriends);
    
    if (newSelected.has(friend.fid)) {
      newSelected.delete(friend.fid);
    } else if (newSelected.size < maxSelection) {
      newSelected.add(friend.fid);
    }
    
    setSelectedFriends(newSelected);
    
    // Notify parent of selection change
    const selectedFriendObjects = friends.filter(f => newSelected.has(f.fid));
    onSelectionChange(selectedFriendObjects);
  };

  const selectAll = () => {
    const allFids = friends.slice(0, maxSelection).map(f => f.fid);
    const newSelected = new Set(allFids);
    setSelectedFriends(newSelected);
    onSelectionChange(friends.filter(f => newSelected.has(f.fid)));
  };

  const clearAll = () => {
    setSelectedFriends(new Set());
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Your Best Friends</h3>
          <div className="loading loading-spinner loading-sm"></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square bg-base-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || friends.length === 0) {
    return (
      <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
        <h3 className="text-base font-semibold mb-4">Your Best Friends</h3>
        <div className="text-center py-8">
          <div className="text-base-content/60 mb-2">
            {error || "No best friends found with Ethereum addresses"}
          </div>
          <div className="text-sm text-base-content/40">
            Best friends need verified Ethereum addresses to receive streams
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">
          Your Best Friends
          {selectedFriends.size > 0 && (
            <span className="text-sm font-normal text-base-content/60 ml-2">
              ({selectedFriends.size} selected)
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          {friends.length > 0 && (
            <>
              <button
                onClick={selectAll}
                className="btn btn-ghost btn-xs"
                disabled={selectedFriends.size === Math.min(maxSelection, friends.length)}
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className="btn btn-ghost btn-xs"
                disabled={selectedFriends.size === 0}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {friends.map((friend) => {
          const isSelected = selectedFriends.has(friend.fid);
          const canSelect = isSelected || selectedFriends.size < maxSelection;
          
          return (
            <button
              key={friend.fid}
              onClick={() => toggleFriendSelection(friend)}
              disabled={!canSelect}
              className={`
                relative p-3 rounded-xl border-2 transition-all duration-200 text-left
                ${isSelected 
                  ? 'border-primary bg-primary/10' 
                  : canSelect
                    ? 'border-base-300 hover:border-primary/50 hover:bg-base-200/50'
                    : 'border-base-200 opacity-50 cursor-not-allowed'
                }
              `}
            >
              {/* Selection indicator */}
              <div className={`
                absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${isSelected 
                  ? 'border-primary bg-primary' 
                  : 'border-base-300'
                }
              `}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              
              {/* Avatar */}
              <div className="w-12 h-12 mx-auto mb-2 rounded-full overflow-hidden">
                <SafeImage
                  src={friend.pfp_url}
                  alt={friend.username}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Name */}
              <div className="text-center">
                <div className="text-sm font-medium truncate">
                  @{friend.username}
                </div>
                <div className="text-xs text-base-content/60 truncate">
                  {friend.display_name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {selectedFriends.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <div className="text-sm text-primary font-medium mb-1">
            Ready to stream equally to {selectedFriends.size} friends
          </div>
          <div className="text-xs text-base-content/60">
            Each friend will receive an equal portion of your available flow rate
          </div>
        </div>
      )}
    </div>
  );
}