"use client";

import { useState, useEffect, useRef } from "react";
import SafeImage from "../../../components/SafeImage";

interface User {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
  follower_count: number;
  following_count: number;
}

interface UserSearchProps {
  onUserSelect: (user: User) => void;
}

export function UserSearch({ onUserSelect }: UserSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (searchTerm.length === 0) {
      setUsers([]);
      setIsOpen(false);
      return;
    }

    if (searchTerm.length < 2) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm)}&limit=10`);
        const data = await response.json();
        
        if (data.success) {
          // Filter users to only show those with either custody_address or verified eth addresses
          const filteredUsers = data.data.users.filter((user: User) => 
            user.custody_address || (user.verified_addresses?.eth_addresses?.length > 0)
          );
          setUsers(filteredUsers);
          setIsOpen(filteredUsers.length > 0);
        } else {
          setUsers([]);
          setIsOpen(false);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setUsers([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUserSelect = (user: User) => {
    onUserSelect(user);
    setSearchTerm(user.username);
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Search by username (e.g., @username)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input input-bordered w-full pr-10"
          onFocus={() => {
            if (searchTerm.length >= 2 && users.length > 0) {
              setIsOpen(true);
            }
          }}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="loading loading-spinner loading-sm"></div>
          </div>
        )}
        
        {!isLoading && searchTerm.length > 0 && (
          <button
            onClick={() => {
              setSearchTerm("");
              setUsers([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:text-error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && users.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {users.map((user) => (
            <button
              key={user.fid}
              onClick={() => handleUserSelect(user)}
              className="w-full p-3 hover:bg-base-200 border-b border-base-300 last:border-b-0 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="w-10 h-10 rounded-full">
                    {user.pfp_url ? (
                      <SafeImage
                        src={user.pfp_url}
                        alt={user.username}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center">
                        <span className="text-xs font-mono">
                          {user.username[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">@{user.username}</span>
                    <span className="text-xs text-base-content/60">#{user.fid}</span>
                  </div>
                  {user.display_name && user.display_name !== user.username && (
                    <div className="text-sm text-base-content/70 truncate">
                      {user.display_name}
                    </div>
                  )}
                  <div className="text-xs text-base-content/50">
                    {user.follower_count.toLocaleString()} followers
                  </div>
                </div>
                
                {user.verified_addresses.eth_addresses.length > 0 && (
                  <div className="flex-shrink-0">
                    <div className="badge badge-success badge-sm">Verified</div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && searchTerm.length >= 2 && users.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg p-4">
          <div className="text-center text-base-content/60">
            No users found for &quot;{searchTerm}&quot;
          </div>
        </div>
      )}
    </div>
  );
}