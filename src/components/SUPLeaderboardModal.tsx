"use client";

import { useEffect, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import Image from "next/image";
import { X } from "lucide-react";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useSafeWalletAuth } from "../hooks/useSafeWallet";
import { useFarcasterAuth } from "../hooks/useFarcasterAuth";
import { useSupPoints } from "../hooks/useSupPoints";
import { useSupEligibility } from "../hooks/useSupEligibility";
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
import { usePostHog } from "posthog-js/react";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics";

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
  displayRank?: string; // For showing ">50" when user is ranked over 50
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

export function SUPLeaderboardModal({
  isOpen,
  onClose,
}: LeaderboardModalProps) {
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<
    ProcessedLeaderboardEntry[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfoView, setShowInfoView] = useState(false);

  // Claim flow state
  const [claimStep, setClaimStep] = useState<ClaimStep>("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [processedTransactions, setProcessedTransactions] = useState<
    Set<string>
  >(new Set());

  // Farcaster Authentication
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
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

  // SUP Eligibility Data
  const {
    eligibilityData,
    isLoading: isEligibilityLoading,
    error: eligibilityError,
    fetchEligibility,
    getFormattedFlowRate,
  } = useSupEligibility();

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

  const { user: connectedUser } = useSafeWalletAuth();
  const {
    isMiniAppView,
    address: fcAddress,
    isConnected: isFcConnected,
  } = useAppFrameLogic();

  // Get effective address and connection status based on context
  const effectiveAddress = isMiniAppView
    ? fcAddress
    : connectedUser?.wallet?.address;
  const isWalletConnected = isMiniAppView ? isFcConnected : isWagmiConnected;

  // Check locker status after creation transaction succeeds
  const { data: lockerData, refetch: refetchLockerData } = useReadContract({
    address: SUPERFLUID_BASE_CONTRACTS.FLUID_LOCKER_FACTORY,
    abi: FLUID_LOCKER_FACTORY_ABI,
    functionName: "getUserLocker",
    args: effectiveAddress ? [effectiveAddress as Address] : undefined,
    query: {
      enabled: !!effectiveAddress && claimStep === "creating-locker",
      refetchInterval: false, // Only refetch manually when transactions complete
    },
  });

  const postHog = usePostHog();

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
    if (isAuthenticated) {
      fetchUserData();
    } else if (!isAuthenticated) {
      clearPointsData();
    }
  }, [isAuthenticated, fetchUserData, clearPointsData]);

  // Fetch SUP eligibility when address is available
  useEffect(() => {
    if (effectiveAddress && !eligibilityData && !isEligibilityLoading) {
      console.log(
        "LeaderboardModal: Fetching SUP eligibility for:",
        effectiveAddress
      );
      fetchEligibility(effectiveAddress).catch((error) => {
        console.error(
          "LeaderboardModal: Error fetching SUP eligibility:",
          error
        );
      });
    }
  }, [
    effectiveAddress,
    eligibilityData,
    isEligibilityLoading,
    fetchEligibility,
  ]);

  // Handle successful locker creation
  useEffect(() => {
    if (
      isCreateLockerSuccess &&
      createLockerHash &&
      !processedTransactions.has(createLockerHash)
    ) {
      console.log("Locker creation transaction confirmed:", createLockerHash);
      setProcessedTransactions((prev) => new Set(prev).add(createLockerHash));
      // Wait a moment then check the contract state
      setTimeout(() => {
        refetchLockerData();
      }, 1000);

      // PostHog event tracking for locker creation
      postHog.capture(POSTHOG_EVENTS.SUP_LOCKER_CREATED, {
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: createLockerHash,
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: effectiveAddress,
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isMiniAppView
          ? "farcaster"
          : "wagmi",
      });
    }
  }, [
    isCreateLockerSuccess,
    createLockerHash,
    processedTransactions,
    refetchLockerData,
    postHog,
    effectiveAddress,
    isMiniAppView,
  ]);

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
    if (isClaimSuccess && claimHash && !processedTransactions.has(claimHash)) {
      console.log("Claim transaction confirmed:", claimHash);
      setProcessedTransactions((prev) => new Set(prev).add(claimHash));
      setClaimStep("success");

      // PostHog event tracking for successful SUP claim
      postHog.capture(POSTHOG_EVENTS.SUP_CLAIM_SUCCESS, {
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: claimHash,
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: effectiveAddress,
        [ANALYTICS_PROPERTIES.SUP_POINTS_AMOUNT]:
          userData?.points.totalEarned || 0,
        [ANALYTICS_PROPERTIES.LOCKER_ADDRESS]:
          userData?.fluidLocker.address || "",
        [ANALYTICS_PROPERTIES.CLAIM_PROGRAM_ID]: 7786,
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isMiniAppView
          ? "farcaster"
          : "wagmi",
      });
    }
  }, [
    isClaimSuccess,
    claimHash,
    processedTransactions,
    postHog,
    effectiveAddress,
    isMiniAppView,
  ]);

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
      const programId = 7786;
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
    if (claimStep === "claiming" || isClaimPending) return "Claiming SUP...";
    if (claimStep === "success") return "✅ Claimed Successfully!";
    if (claimStep === "error") return "Try Again";

    if (!userData) return "Loading...";
    if (userData.points.totalEarned <= 0) return "No SUP to claim";

    return "Claim your SUP stream";
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
          entry.address &&
          entry.address?.toLowerCase() === effectiveAddress?.toLowerCase()
      ),
      displayInfo: getDisplayInfo(entry),
    }));

    // Create a map to track the highest ranked entry for each username
    const usernameMap = new Map<string, (typeof withDisplayInfo)[0]>();

    withDisplayInfo.forEach((entry) => {
      const username = entry.displayInfo.name?.toLowerCase() || "";
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

    // If current user exists, always show them first
    if (currentUserEntry) {
      // Get other entries excluding the current user
      const otherEntries = rerankedData.filter((entry) => !entry.isCurrentUser);

      // If user is ranked over 50, show ">50" as their rank
      if (currentUserEntry.rank > 50) {
        const modifiedCurrentUser = {
          ...currentUserEntry,
          displayRank: ">50",
        };
        // Return current user first, followed by top 49 others
        return [modifiedCurrentUser, ...otherEntries.slice(0, 49)];
      }

      // Return current user first, followed by others (up to 50 total)
      return [currentUserEntry, ...otherEntries.slice(0, 49)];
    }

    // If no current user, just show the top entries
    return rerankedData.slice(0, Math.min(rerankedData.length, 50));
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
      if (identity && identity.displayName) {
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-base-content/70">
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
            onClick={authError ? signIn : () => fetchUserData()}
            className="text-primary hover:text-primary/80 text-sm underline"
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
          <p className="text-base-content/70 text-sm mb-3">
            Sign in with Farcaster to claim SUP stream
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
          <p className="text-base-content/70 text-sm">
            Loading your points data...
          </p>
        </div>
      );
    }

    // Authenticated with data - show streamlined claim section
    return (
      <div className="py-4">
        {/* SUP Eligibility Info */}
        {eligibilityData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-blue-900 text-sm">
                SUP Flow Rate
              </h4>
            </div>
            <p className="text-blue-700 text-sm">
              <span className="font-mono font-medium">
                {getFormattedFlowRate()}
              </span>
              {eligibilityData.claimNeeded && (
                <span className="ml-2 text-orange-600">• Claim Available</span>
              )}
            </p>
          </div>
        )}

        {/* Eligibility Loading State */}
        {isEligibilityLoading && (
          <div className="bg-base-200 border border-base-300 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <p className="text-base-content/70 text-sm">
                Loading SUP eligibility...
              </p>
            </div>
          </div>
        )}

        {/* Eligibility Error State */}
        {eligibilityError && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
            <p className="text-orange-600 text-sm">
              ⚠️ Could not load SUP eligibility data
            </p>
          </div>
        )}

        {/* Claim Error Display */}
        {claimStep === "error" && claimError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-600 text-sm">{claimError}</p>
          </div>
        )}

        {/* Success Message */}
        {claimStep === "success" && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-3">
            <p className="text-green-700 text-sm text-center font-medium mb-3">
              🎉 SUP stream claimed successfully!
            </p>
            <div className="text-center">
              <p className="text-green-600 text-xs mb-3">
                Earn more SUP by using other Superfluid ecosystem apps.
              </p>
              <button
                onClick={handleClaimAirdrop}
                className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
                style={{
                  backgroundColor: "rgb(117, 235, 0)",
                  color: "black",
                }}
              >
                View More Earning Opportunities
              </button>
            </div>
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
          {claimStep === "success" ? (
            <div
              className="flex-1 px-6 py-3 rounded-lg font-semibold text-center"
              style={{
                backgroundColor: "rgb(117, 235, 0)",
                color: "black",
              }}
            >
              ✅ Claimed Successfully!
            </div>
          ) : (
            <button
              onClick={handleClaimClick}
              className="flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={{
                backgroundColor: "rgb(117, 235, 0)",
                color: "black",
              }}
              disabled={
                isClaimLoading ||
                (userData.points.totalEarned <= 0 && claimStep !== "error") ||
                !isWalletConnected
              }
            >
              {isClaimLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2 inline-block"></div>
              )}
              {getClaimButtonText()}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderInfoView = () => {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <p className="text-base-content/70 text-sm">
              Streme is part of Season 2 of SUP streaming rewards. SUP is the
              ecosystem token of Superfluid.
            </p>
          </div>

          {/* What is SUP */}
          <div className="bg-base-200 rounded-lg p-4">
            <h3 className="font-semibold text-base-content mb-2">
              What is SUP?
            </h3>
            <div className="text-center mb-4">
              <img
                src="https://docs.streme.fun/~gitbook/image?url=https%3A%2F%2F1755512155-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FrfU6UkNRL91DlMTjk2m7%252Fuploads%252FCiLpsJHSRIuHRC0xUTrY%252FSuperfluid___Claim_App.png%3Falt%3Dmedia%26token%3D68242eb6-816b-420b-9bd6-91936f3244b4&width=400&dpr=2&quality=100&sign=d002354a&sv=2"
                alt="The SUP claim page on the Superfluid website"
                className="max-w-full h-auto rounded"
              />
              <p className="text-xs text-base-content/60 mt-2">
                The SUP claim page on the Superfluid website
              </p>
            </div>
            <p className="text-sm text-base-content/80">
              Don&apos;t call it an airdrop. Superfluid powers tokens that
              stream value in real-time, per second. Ongoing engagement with the
              Superfluid protocol earns you streaming rewards of SUP.
            </p>
          </div>

          {/* How to Earn */}
          <div className="bg-base-200 rounded-lg p-4">
            <h3 className="font-semibold text-base-content mb-3">
              How to Earn SUP with Streme
            </h3>
            <div className="bg-base-100 border border-base-300 rounded p-3 mb-3">
              <p className="text-sm font-medium text-base-content">
                💡 Actions that contribute to the market success of Streme coins
                will earn the most SUP rewards
              </p>
            </div>
            <div className="space-y-2 text-sm text-base-content/80">
              <div className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                <span>
                  Adding the Streme Farcaster mini app (keep notifications
                  enabled)
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-green-600">•</span>

                <span>
                  Creating tokens with high volume and/or high market cap
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-green-600">•</span>

                <span>Holding Streme coins</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">•</span>

                <span>Holding staked Streme coins</span>
              </div>
            </div>
          </div>

          {/* Key Message */}
          <div className="bg-base-200 border border-base-300 rounded-lg p-4">
            <p className="text-sm font-semibold text-base-content text-center">
              Rewards flow to those who contribute most to the market success of
              Streme.
            </p>
          </div>
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
      <div className="relative w-full max-w-md bg-base-100 rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <div>
            <h3 className="text-lg font-semibold text-base-content flex items-center gap-2">
              {!showInfoView && (
                <svg
                  className="w-5 h-5 mb-0.5"
                  viewBox="0 0 45 45"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M38.8027 0.647461H38.8076L39.0498 0.683594C40.2423 0.919985 41.1413 1.97266 41.1416 3.23438V39.0176C41.1416 40.4533 39.9777 41.6179 38.542 41.6182H3.02539C1.58945 41.6182 0.424805 40.4535 0.424805 39.0176V3.23438C0.425198 1.79873 1.58972 0.634766 3.02539 0.634766H38.5469L38.8027 0.647461ZM4.3252 37.7178H37.2422V4.53418H4.3252V37.7178ZM14.623 26.8369C14.954 26.8369 15.2234 27.1051 15.2236 27.4365V29.9697C15.2236 30.301 14.955 30.569 14.624 30.5693H12.0898C11.7585 30.5693 11.4902 30.3011 11.4902 29.9697V27.4365C11.4904 27.1053 11.7586 26.8369 12.0898 26.8369H14.623ZM27.1045 12.0127C27.8143 12.0127 28.3552 12.0123 28.7627 12.0576C29.1691 12.1028 29.4651 12.195 29.668 12.3975C29.8708 12.6003 29.9635 12.8971 30.0088 13.3037C30.0541 13.7112 30.0537 14.2523 30.0537 14.9619V22.9141C30.0537 23.2465 29.7835 23.5107 29.4531 23.5107H26.7539C26.4225 23.5107 26.1543 23.2425 26.1543 22.9111V16.3115C26.1541 16.091 25.974 15.9111 25.7529 15.9111H20.2695C19.9382 15.9111 19.67 15.6428 19.6699 15.3115V12.6123C19.6701 12.2814 19.9374 12.013 20.2686 12.0127H27.1045Z" />
                </svg>
              )}
              {showInfoView ? "SUP Rewards Info" : "SUP Rewards Leaderboard"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfoView(!showInfoView)}
              className="p-2 hover:bg-base-200 rounded-full transition-colors cursor-pointer"
              title={showInfoView ? "Show Leaderboard" : "Show Info"}
            >
              {showInfoView ? (
                <svg
                  className="w-5 h-5 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-base-content/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-base-200 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} className="text-base-content/60" />
            </button>
          </div>
        </div>

        {/* Content */}
        {showInfoView ? (
          renderInfoView()
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-error mb-4">{error}</p>
                <button
                  onClick={fetchLeaderboardData}
                  className="btn btn-primary"
                >
                  Retry
                </button>
              </div>
            ) : leaderboardData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-base-content/70">
                  No leaderboard data available
                </p>
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
                      className={`flex items-center space-x-3 p-1 py-2 rounded-lg transition-colors border-b border-base-300 ${
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
                            ? "bg-blue-500 text-base-100"
                            : isTopThree
                            ? `${rankColors[entry.rank - 1]} bg-base-100`
                            : "text-base-content/70 bg-base-100 "
                        }`}
                      >
                        {entry.displayRank || entry.rank}
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
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-base-200 flex-shrink-0">
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
                          <div className="font-medium text-base-content truncate flex items-center gap-2">
                            {entry.displayInfo.name}
                            {isCurrentUser && (
                              <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-base-content/70">
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
        )}

        {/* Footer - Updated with Auth & Claim Flow */}
        <div className="px-4 py-2 border-t border-base-300 space-y-3">
          <p className="text-xs text-base-content/70">
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
