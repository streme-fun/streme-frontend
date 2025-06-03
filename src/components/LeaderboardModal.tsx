"use client";

import { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";
import Image from "next/image";
import { X } from "lucide-react";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { usePrivy } from "@privy-io/react-auth";
import { useFarcasterAuth } from "../hooks/useFarcasterAuth";
import { useSupPoints } from "../hooks/useSupPoints";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { Address } from "viem";
import {
  SUPERFLUID_BASE_CONTRACTS,
  FLUID_LOCKER_FACTORY_ABI,
  FLUID_LOCKER_ABI,
} from "@/src/lib/superfluid-contracts";

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

type ClaimStep =
  | "idle"
  | "checking"
  | "creating-locker"
  | "claiming"
  | "success"
  | "error";

export function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<
    ProcessedLeaderboardEntry[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Claim flow state
  const [claimStep, setClaimStep] = useState<ClaimStep>("idle");
  const [claimError, setClaimError] = useState<string | null>(null);

  // Farcaster Authentication
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    token,
    signIn,
  } = useFarcasterAuth();

  // SUP Points Data
  const {
    userData,
    isLoading: pointsLoading,
    error: pointsError,
    fetchUserData,
    clearData: clearPointsData,
  } = useSupPoints();

  // Wallet connection
  const { isConnected: isWagmiConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Transaction hooks
  const { writeContract: createLocker, data: createLockerHash } =
    useWriteContract();
  const { writeContract: claimPoints, data: claimHash } = useWriteContract();

  const {
    isLoading: isCreateLockerPending,
    isSuccess: isCreateLockerSuccess,
    error: createLockerError,
  } = useWaitForTransactionReceipt({
    hash: createLockerHash,
  });

  const {
    isLoading: isClaimPending,
    isSuccess: isClaimSuccess,
    error: claimTransactionError,
  } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  const { user: privyUser } = usePrivy();
  const {
    isMiniAppView,
    address: fcAddress,
    isConnected: isFcConnected,
  } = useAppFrameLogic();

  // Get effective address and connection status based on context
  const effectiveAddress = isMiniAppView
    ? fcAddress
    : privyUser?.wallet?.address;
  const isWalletConnected = isMiniAppView ? isFcConnected : isWagmiConnected;

  // Check locker status after creation transaction succeeds
  const { data: lockerData, refetch: refetchLockerData } = useReadContract({
    address: SUPERFLUID_BASE_CONTRACTS.FLUID_LOCKER_FACTORY,
    abi: FLUID_LOCKER_FACTORY_ABI,
    functionName: "getUserLocker",
    args: effectiveAddress ? [effectiveAddress as Address] : undefined,
    query: {
      enabled: !!effectiveAddress && claimStep === "creating-locker",
      refetchInterval: claimStep === "creating-locker" ? 2000 : false,
    },
  });

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
      // Auto-signin when modal opens if not already authenticated
      if (!isAuthenticated && !authLoading) {
        handleAutoSignIn();
      }
    }
  }, [isOpen, effectiveAddress]);

  // Fetch user points data when authentication succeeds
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUserData(token);
    } else if (!isAuthenticated) {
      clearPointsData();
    }
  }, [isAuthenticated, token, fetchUserData, clearPointsData]);

  // Handle successful locker creation
  useEffect(() => {
    if (isCreateLockerSuccess && createLockerHash) {
      console.log("Locker creation transaction confirmed:", createLockerHash);
      setTimeout(() => {
        refetchLockerData();
      }, 1000);
    }
  }, [isCreateLockerSuccess, createLockerHash, refetchLockerData]);

  // Handle locker data updates
  useEffect(() => {
    if (lockerData && claimStep === "creating-locker") {
      const [isCreated, lockerAddress] = lockerData as [boolean, string];
      if (
        isCreated &&
        lockerAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        console.log("Locker detected at address:", lockerAddress);
        setClaimStep("claiming");
        claimPointsTransaction(lockerAddress);
      }
    }
  }, [lockerData, claimStep]);

  // Handle successful claim
  useEffect(() => {
    if (isClaimSuccess && claimHash) {
      console.log("Claim transaction confirmed:", claimHash);
      setClaimStep("success");
      setTimeout(() => {
        refreshUserData();
        setClaimStep("idle");
      }, 3000);
    }
  }, [isClaimSuccess, claimHash]);

  // Handle transaction errors
  useEffect(() => {
    if (createLockerError) {
      console.error("Locker creation failed:", createLockerError);
      setClaimError(`Locker creation failed: ${createLockerError.message}`);
      setClaimStep("error");
    }
  }, [createLockerError]);

  useEffect(() => {
    if (claimTransactionError) {
      console.error("Claim transaction failed:", claimTransactionError);
      setClaimError(`Claim failed: ${claimTransactionError.message}`);
      setClaimStep("error");
    }
  }, [claimTransactionError]);

  const handleAutoSignIn = async () => {
    try {
      console.log("Auto-signing in to Farcaster...");
      await signIn();
    } catch (error) {
      console.warn("Auto sign-in failed, user can manually sign in:", error);
    }
  };

  const refreshUserData = async () => {
    if (token) {
      await fetchUserData(token);
    }
  };

  const startDirectClaimFlow = async () => {
    if (!effectiveAddress) {
      setClaimError("Please connect your wallet first");
      setClaimStep("error");
      return;
    }

    if (!userData || userData.points.totalEarned <= 0) {
      setClaimError(
        "No points available to claim. Complete Stack tasks to earn SUP points."
      );
      setClaimStep("error");
      return;
    }

    if (!userData.points.stackSignedData) {
      setClaimError(
        "No signed points data available. Please refresh and try again."
      );
      setClaimStep("error");
      return;
    }

    setClaimStep("checking");
    setClaimError(null);

    try {
      if (!userData.fluidLocker.isCreated) {
        setClaimStep("creating-locker");
        await createLockerTransaction();
      } else {
        setClaimStep("claiming");
        await claimPointsTransaction(userData.fluidLocker.address!);
      }
    } catch (err) {
      console.error("Claim flow error:", err);
      setClaimError(
        err instanceof Error ? err.message : "Unknown error occurred"
      );
      setClaimStep("error");
    }
  };

  const createLockerTransaction = async () => {
    try {
      createLocker({
        address: SUPERFLUID_BASE_CONTRACTS.FLUID_LOCKER_FACTORY,
        abi: FLUID_LOCKER_FACTORY_ABI,
        functionName: "createLockerContract",
      });
    } catch (err) {
      throw new Error(
        `Failed to create locker: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  const claimPointsTransaction = async (lockerAddress: string) => {
    if (!userData?.points.stackSignedData) {
      throw new Error("No signed points data available");
    }

    try {
      const rawSignature = userData.points.stackSignedData;
      const programId = 7692;
      const totalProgramUnits = userData.points.totalEarned;
      const nonce = userData.points.signatureTimestamp || 1748439037;

      console.log("Attempting claim with parameters:", {
        lockerAddress,
        programId,
        totalProgramUnits,
        nonce,
        signature: rawSignature,
      });

      claimPoints({
        address: lockerAddress as Address,
        abi: FLUID_LOCKER_ABI,
        functionName: "claim",
        args: [
          BigInt(programId),
          BigInt(totalProgramUnits),
          BigInt(nonce),
          rawSignature as `0x${string}`,
        ],
      });
    } catch (err) {
      console.error("Claim transaction failed:", err);
      throw new Error(
        `Failed to claim points: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  const handleClaimClick = async () => {
    if (!isAuthenticated) {
      try {
        await signIn();
      } catch (error) {
        console.error("Sign-in failed:", error);
        return;
      }
    } else {
      await startDirectClaimFlow();
    }
  };

  const getClaimButtonText = () => {
    if (claimStep === "checking") return "Checking...";
    if (claimStep === "creating-locker" || isCreateLockerPending)
      return "Creating Locker...";
    if (claimStep === "claiming" || isClaimPending) return "Claiming Points...";
    if (claimStep === "success") return "✅ Claimed Successfully!";
    if (claimStep === "error") return "Try Again";

    if (!userData) return "Loading...";
    if (userData.points.totalEarned <= 0) return "No Points to Claim";

    return "Claim $SUP Stream";
  };

  const isClaimLoading =
    claimStep === "checking" ||
    claimStep === "creating-locker" ||
    claimStep === "claiming" ||
    isCreateLockerPending ||
    isClaimPending;

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

  const renderAuthAndClaimSection = () => {
    // Loading state
    if (authLoading || pointsLoading) {
      return (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">
            {authLoading ? "Authenticating..." : "Loading points data..."}
          </p>
        </div>
      );
    }

    // Error state
    if (authError || pointsError) {
      return (
        <div className="text-center py-4">
          <p className="text-red-600 text-sm mb-2">
            {authError || pointsError}
          </p>
          <button
            onClick={authError ? signIn : refreshUserData}
            className="text-blue-600 hover:text-blue-700 text-sm underline"
          >
            {authError ? "Try Sign In Again" : "Retry Loading"}
          </button>
        </div>
      );
    }

    // Not authenticated
    if (!isAuthenticated) {
      return (
        <div className="text-center py-4">
          <p className="text-gray-600 text-sm mb-3">
            Sign in with Farcaster to claim $SUP stream
          </p>
          <button
            onClick={signIn}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            Sign In with Farcaster
          </button>
        </div>
      );
    }

    // Authenticated but no user data
    if (!userData) {
      return (
        <div className="text-center py-4">
          <p className="text-gray-600 text-sm">Loading your points data...</p>
        </div>
      );
    }

    // Authenticated with data - show streamlined claim section
    return (
      <div className="py-4">
        {/* Claim Error Display */}
        {claimStep === "error" && claimError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-600 text-sm">{claimError}</p>
          </div>
        )}

        {/* Success Message */}
        {claimStep === "success" && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-3 mb-3">
            <p className="text-green-700 text-sm text-center">
              🎉 SUP points claimed successfully!
            </p>
          </div>
        )}

        {/* Wallet Connection Status */}
        {!isWalletConnected && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
            <div className="text-orange-600 text-sm mb-2">
              ⚠️ Wallet not connected
            </div>
            <button
              onClick={() =>
                connectors[0] && connect({ connector: connectors[0] })
              }
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Connect Wallet
            </button>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={handleClaimClick}
            className="btn btn-primary flex-1"
            disabled={
              isClaimLoading ||
              (userData.points.totalEarned <= 0 && claimStep !== "error") ||
              !isWalletConnected
            }
          >
            {isClaimLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
            )}
            {getClaimButtonText()}
          </button>
          <button onClick={handleClaimAirdrop} className="btn btn-ghost px-3">
            External Claim
          </button>
        </div>
      </div>
    );
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

        {/* Footer - Updated with Auth & Claim Flow */}
        <div className="px-4 py-2 border-t border-gray-200 space-y-3">
          <p className="text-xs text-gray-600">
            Launch, ape, and stake on Streme to qualify for the Superfluid $SUP
            airdrop. The hotter your coins, the more you earn.
          </p>

          {/* Auth and Claim Section */}
          {renderAuthAndClaimSection()}
        </div>
      </div>
    </div>
  );
}
