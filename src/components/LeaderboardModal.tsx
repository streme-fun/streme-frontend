"use client";

import { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";
import Image from "next/image";
import { X } from "lucide-react";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { usePrivy } from "@privy-io/react-auth";

interface Identity {
  walletAddress: string;
  identityType: string;
  identifier: string;
  displayName: string;
  profileImageUrl?: string;
}

interface LeaderboardEntry {
  address: string;
  identities: {
    Farcaster?: Identity;
    ENS?: Identity;
    Lens?: Identity;
    Basename?: Identity;
    "Talent Passport"?: Identity;
  };
}

interface ProcessedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
  isCurrentUser: boolean;
  displayInfo: {
    name: string;
    image: string | null;
    type: string;
  };
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<
    ProcessedLeaderboardEntry[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user: privyUser } = usePrivy();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();

  // Get effective address based on mini-app context
  const effectiveAddress = isMiniAppView
    ? fcAddress
    : privyUser?.wallet?.address;

  useEffect(() => {
    if (sdk && sdk.actions) {
      setIsSDKReady(true);
    } else {
      setIsSDKReady(false);
      console.warn("Farcaster SDK or sdk.actions is not available.");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboardData();
    }
  }, [isOpen, effectiveAddress]);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/leaderboard");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      const rawData = result.data || [];
      const processedData = processLeaderboardData(rawData);
      setLeaderboardData(processedData);
    } catch (err) {
      console.error("Error fetching leaderboard data:", err);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  const processLeaderboardData = (
    rawData: LeaderboardEntry[]
  ): ProcessedLeaderboardEntry[] => {
    // First, add display info and original ranks to all entries
    const withDisplayInfo = rawData.map((entry, index) => ({
      ...entry,
      originalRank: index + 1,
      isCurrentUser: Boolean(
        effectiveAddress &&
          entry.address.toLowerCase() === effectiveAddress.toLowerCase()
      ),
      displayInfo: getDisplayInfo(entry),
    }));

    // Create a map to track the highest ranked entry for each username
    const usernameMap = new Map<string, (typeof withDisplayInfo)[0]>();

    withDisplayInfo.forEach((entry) => {
      const username = entry.displayInfo.name.toLowerCase();
      const existing = usernameMap.get(username);

      // Keep the entry with the better rank (lower rank number = higher position)
      if (!existing || entry.originalRank < existing.originalRank) {
        usernameMap.set(username, entry);
      }
    });

    // Convert back to array, removing duplicates and sort by original rank
    const deduplicatedData = Array.from(usernameMap.values()).sort(
      (a, b) => a.originalRank - b.originalRank
    );

    // Re-rank entries sequentially after deduplication
    const rerankedData = deduplicatedData.map((entry, index) => ({
      ...entry,
      rank: index + 1, // New sequential rank
    }));

    // Find current user entry in the re-ranked data
    const currentUserEntry = rerankedData.find((entry) => entry.isCurrentUser);

    // If current user exists and is not in the top 10, show them first followed by top 10
    if (currentUserEntry && currentUserEntry.rank > 10) {
      // Get top 10 (excluding current user if they're somehow in top 10)
      const top10 = rerankedData
        .filter((entry) => !entry.isCurrentUser)
        .slice(0, 10);
      return [currentUserEntry, ...top10];
    }

    // Otherwise, just show the normal re-ranked list (current user will be in their natural position)
    return rerankedData;
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getDisplayInfo = (entry: LeaderboardEntry) => {
    // Safety check for identities property
    if (!entry.identities) {
      return {
        name: truncateAddress(entry.address),
        image: null,
        type: "Address",
      };
    }

    // Priority: Farcaster > ENS > Basename > Lens > Talent Passport
    const identityOrder = [
      "Farcaster",
      "ENS",
      "Basename",
      "Lens",
      "Talent Passport",
    ] as const;

    for (const identityType of identityOrder) {
      const identity = entry.identities[identityType];
      if (identity) {
        return {
          name: identity.displayName,
          image: identity.profileImageUrl || null,
          type: identityType,
        };
      }
    }

    return {
      name: truncateAddress(entry.address),
      image: null,
      type: "Address",
    };
  };

  const getFarcasterFid = (entry: LeaderboardEntry): number | null => {
    // Safety check for identities property
    if (!entry.identities) {
      return null;
    }

    const farcasterIdentity = entry.identities.Farcaster;
    if (farcasterIdentity && farcasterIdentity.identifier) {
      const fid = parseInt(farcasterIdentity.identifier);
      return isNaN(fid) ? null : fid;
    }
    return null;
  };

  const handleProfileClick = async (entry: LeaderboardEntry) => {
    const fid = getFarcasterFid(entry);
    if (!fid) return;

    if (isSDKReady && sdk && sdk.actions && sdk.actions.viewProfile) {
      try {
        await sdk.actions.viewProfile({ fid });
      } catch (error) {
        console.error("Error opening profile via Farcaster SDK:", error);
      }
    } else {
      console.warn("Farcaster SDK not available for viewProfile");
    }
  };

  const handleClaimAirdrop = async () => {
    const claimUrl = "https://claim.superfluid.org/claim";
    if (isSDKReady && sdk && sdk.actions && sdk.actions.openUrl) {
      try {
        await sdk.actions.openUrl(claimUrl);
        onClose();
      } catch (error) {
        console.error("Error opening URL via Farcaster SDK:", error);
        window.open(claimUrl, "_blank");
      }
    } else {
      console.warn(
        "Farcaster SDK not available for openUrl, falling back to window.open."
      );
      window.open(claimUrl, "_blank");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              SUP Airdrop Leaderboard
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchLeaderboardData}
                className="btn btn-primary"
              >
                Retry
              </button>
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No leaderboard data available</p>
            </div>
          ) : (
            <div className="">
              {leaderboardData.map((entry, displayIndex) => {
                const isTopThree = entry.rank <= 3;
                const rankColors = [
                  "text-yellow-500",
                  "text-gray-400",
                  "text-amber-600",
                ];
                const isCurrentUser = entry.isCurrentUser;
                const fid = getFarcasterFid(entry);
                const isClickable = Boolean(fid);

                return (
                  <div
                    key={`${entry.address}-${displayIndex}`}
                    className={`flex items-center space-x-3 p-1 py-2 rounded-lg transition-colors border-b border-gray-50 ${
                      isCurrentUser
                        ? "bg-blue-50 border-2 border-blue-200"
                        : isTopThree
                        ? ""
                        : ""
                    }`}
                  >
                    {/* Rank */}
                    <div
                      className={`flex items-center justify-center w-6 h-6 font-bold text-sm ${
                        isCurrentUser
                          ? "bg-blue-500 text-white"
                          : isTopThree
                          ? `${rankColors[entry.rank - 1]} bg-white`
                          : "text-gray-600 bg-white "
                      }`}
                    >
                      {entry.rank}
                    </div>

                    {/* Clickable Profile Section */}
                    <div
                      className={`flex items-center space-x-3 flex-1 min-w-0 ${
                        isClickable
                          ? "cursor-pointer hover:opacity-80 transition-opacity"
                          : ""
                      }`}
                      onClick={() => isClickable && handleProfileClick(entry)}
                    >
                      {/* Profile Image */}
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                        {entry.displayInfo.image ? (
                          <Image
                            src={entry.displayInfo.image}
                            alt={entry.displayInfo.name}
                            fill
                            className="object-cover"
                            unoptimized={
                              entry.displayInfo.image.includes(".gif") ||
                              entry.displayInfo.image.includes(
                                "imagedelivery.net"
                              )
                            }
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold text-sm">
                            {entry.displayInfo.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Name and Address */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                          {entry.displayInfo.name}
                          {isCurrentUser && (
                            <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          <span className="truncate">
                            {truncateAddress(entry.address)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 space-y-3">
          <p className="text-xs text-gray-600">
            Launch, ape, and stake on Streme to qualify for the Superfluid $SUP
            airdrop. The hotter your coins, the more you earn.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleClaimAirdrop}
              className="btn btn-primary flex-1"
            >
              Claim $SUP Airdrop
            </button>
            {/* <button onClick={onClose} className="btn btn-ghost flex-1">
              Close
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
}
