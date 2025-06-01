"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
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
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";

interface ClaimPointsFlowProps {
  userData: {
    fid: number;
    address: string;
    points: {
      totalEarned: number;
      currentRate: number;
      stackSignedData?: string;
      signatureTimestamp?: number;
    };
    fluidLocker: {
      address: string | null;
      isCreated: boolean;
    };
  };
  onUserDataUpdate?: () => void; // Callback to refresh user data
}

type FlowStep =
  | "idle"
  | "checking"
  | "creating-locker"
  | "claiming"
  | "success"
  | "error";

export function ClaimPointsFlow({
  userData,
  onUserDataUpdate,
}: ClaimPointsFlowProps) {
  const { address: wagmiAddress } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();

  // Get effective address based on context (same logic as WalletProfileModal and FarcasterAuthDemo)
  const userAddress = isMiniAppView ? fcAddress : wagmiAddress;
  const [currentStep, setCurrentStep] = useState<FlowStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdLockerAddress, setCreatedLockerAddress] = useState<
    string | null
  >(null);

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
    error: claimError,
  } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // Check locker status after creation transaction succeeds
  const { data: lockerData, refetch: refetchLockerData } = useReadContract({
    address: SUPERFLUID_BASE_CONTRACTS.FLUID_LOCKER_FACTORY,
    abi: FLUID_LOCKER_FACTORY_ABI,
    functionName: "getUserLocker",
    args: userAddress ? [userAddress as Address] : undefined,
    query: {
      enabled: !!userAddress && currentStep === "creating-locker",
      refetchInterval: currentStep === "creating-locker" ? 2000 : false, // Poll every 2s during creation
    },
  });

  // Handle successful locker creation
  useEffect(() => {
    if (isCreateLockerSuccess && createLockerHash) {
      console.log("Locker creation transaction confirmed:", createLockerHash);
      // Wait a moment then check the contract state
      setTimeout(() => {
        refetchLockerData();
      }, 1000);
    }
  }, [isCreateLockerSuccess, createLockerHash, refetchLockerData]);

  // Handle locker data updates
  useEffect(() => {
    if (lockerData && currentStep === "creating-locker") {
      const [isCreated, lockerAddress] = lockerData as [boolean, string];
      if (
        isCreated &&
        lockerAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        console.log("Locker detected at address:", lockerAddress);
        setCreatedLockerAddress(lockerAddress);
        // Proceed to claiming step
        setCurrentStep("claiming");
        claimPointsTransaction(lockerAddress);
      }
    }
  }, [lockerData, currentStep]);

  // Handle successful claim
  useEffect(() => {
    if (isClaimSuccess && claimHash) {
      console.log("Claim transaction confirmed:", claimHash);
      setCurrentStep("success");
      // Refresh parent component data
      if (onUserDataUpdate) {
        setTimeout(onUserDataUpdate, 2000);
      }
    }
  }, [isClaimSuccess, claimHash, onUserDataUpdate]);

  // Handle transaction errors
  useEffect(() => {
    if (createLockerError) {
      console.error("Locker creation failed:", createLockerError);
      setError(`Locker creation failed: ${createLockerError.message}`);
      setCurrentStep("error");
    }
  }, [createLockerError]);

  useEffect(() => {
    if (claimError) {
      console.error("Claim transaction failed:", claimError);
      setError(`Claim failed: ${claimError.message}`);
      setCurrentStep("error");
    }
  }, [claimError]);

  const startClaimFlow = async () => {
    if (!userAddress) {
      setError("Please connect your wallet first");
      return;
    }

    // Check if there are any points to claim
    if (userData.points.totalEarned <= 0) {
      setError(
        "No points available to claim. Complete Stack tasks to earn SUP points."
      );
      return;
    }

    // Check if signature data is available
    if (!userData.points.stackSignedData) {
      setError(
        "No signed points data available. This may be a temporary issue - try refreshing."
      );
      return;
    }

    // Check if contract addresses are configured
    if (
      !SUPERFLUID_BASE_CONTRACTS.FLUID_LOCKER_FACTORY ||
      SUPERFLUID_BASE_CONTRACTS.FLUID_LOCKER_FACTORY === "0x"
    ) {
      setError(
        "FluidLocker factory contract not configured. Please update contract addresses."
      );
      return;
    }

    setCurrentStep("checking");
    setError(null);

    try {
      // Step 1: Check if locker exists (already done in userData)
      if (!userData.fluidLocker.isCreated) {
        // Step 2: Create locker
        setCurrentStep("creating-locker");
        await createLockerTransaction();
      } else {
        // Skip to claiming
        setCurrentStep("claiming");
        await claimPointsTransaction(userData.fluidLocker.address!);
      }
    } catch (err) {
      console.error("Claim flow error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setCurrentStep("error");
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
    if (!userData.points.stackSignedData) {
      throw new Error("No signed points data available");
    }

    try {
      // Handle raw signature data (not base64-encoded Stack data)
      const rawSignature = userData.points.stackSignedData;

      // Use the correct transaction parameters
      const programId = 7692;
      const totalProgramUnits = userData.points.totalEarned; // Use actual amount from API
      const nonce = userData.points.signatureTimestamp || 1748439037; // Use actual timestamp from API

      console.log("Attempting claim with correct parameters:", {
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
          BigInt(programId), // programId: 7692
          BigInt(totalProgramUnits), // totalProgramUnits: should come from Stack API
          BigInt(nonce), // nonce: signatureTimestamp
          rawSignature as `0x${string}`, // stackSignature from external API
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

  const getStepDisplay = () => {
    // Check if no points to claim
    if (userData.points.totalEarned <= 0) {
      return {
        title: "No Points Available",
        description:
          "Complete Stack tasks to earn SUP points that can be claimed.",
        buttonText: "View Stack Tasks",
        showButton: true,
        isExternalAction: true,
      };
    }

    // Check if has points but no signature data (shouldn't happen normally)
    if (userData.points.totalEarned > 0 && !userData.points.stackSignedData) {
      return {
        title: "Signature Missing",
        description: `You have ${userData.points.totalEarned.toLocaleString()} points but signature data is missing. Please refresh or contact support.`,
        buttonText: "Refresh Data",
        showButton: true,
        isExternalAction: true,
      };
    }

    switch (currentStep) {
      case "idle":
        return {
          title: "Ready to Claim",
          description: `Claim ${userData.points.totalEarned.toLocaleString()} SUP points`,
          buttonText: "Start Claim Process",
          showButton: true,
        };
      case "checking":
        return {
          title: "Checking Locker...",
          description: "Verifying your FluidLocker status",
          showButton: false,
        };
      case "creating-locker":
        return {
          title: "Creating Locker",
          description: "Creating your FluidLocker contract...",
          showButton: false,
        };
      case "claiming":
        return {
          title: "Claiming Points",
          description: "Submitting your points claim...",
          showButton: false,
        };
      case "success":
        return {
          title: "✅ Success!",
          description: "Your SUP points have been claimed successfully",
          showButton: false,
        };
      case "error":
        return {
          title: "❌ Error",
          description: error || "An unknown error occurred",
          buttonText: "Try Again",
          showButton: true,
          showDetails: true,
        };
      default:
        return {
          title: "Unknown State",
          description: "",
          showButton: false,
        };
    }
  };

  const handleButtonClick = () => {
    if (stepDisplay.isExternalAction) {
      // Handle external actions
      if (stepDisplay.buttonText === "Complete Stack Verification") {
        window.open("https://www.stack.so/", "_blank");
      } else if (stepDisplay.buttonText === "View Stack Tasks") {
        window.open("https://www.stack.so/", "_blank");
      } else if (stepDisplay.buttonText === "Refresh Data") {
        // Trigger parent data refresh
        if (onUserDataUpdate) {
          onUserDataUpdate();
        }
      }
    } else {
      // Handle normal claim flow
      if (currentStep === "error") {
        startClaimFlow();
      } else {
        startClaimFlow();
      }
    }
  };

  const stepDisplay = getStepDisplay();
  const isLoading =
    currentStep === "checking" ||
    currentStep === "creating-locker" ||
    currentStep === "claiming" ||
    isCreateLockerPending ||
    isClaimPending;

  return (
    <div className="p-6 border rounded-lg bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          {stepDisplay.title}
        </h3>
        <p className="text-gray-600 mb-6">{stepDisplay.description}</p>

        {stepDisplay.showButton && (
          <button
            onClick={handleButtonClick}
            disabled={
              isLoading || (!userAddress && !stepDisplay.isExternalAction)
            }
            className={`${
              stepDisplay.isExternalAction
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            } text-white px-6 py-3 rounded-lg disabled:bg-gray-400 transform hover:scale-105 transition-all duration-200 font-semibold`}
          >
            {isLoading ? "Processing..." : stepDisplay.buttonText}
          </button>
        )}

        {currentStep === "error" && error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg text-sm">
            <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
            <p className="text-red-700 mb-3">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          </div>
        )}

        <div className="mt-6 p-4 bg-white rounded-lg border text-sm">
          <h4 className="font-semibold text-gray-800 mb-2">Claim Process:</h4>
          <ol className="list-decimal list-inside space-y-1 text-gray-600">
            <li
              className={
                userData.points.totalEarned <= 0
                  ? "text-orange-600 font-medium"
                  : "line-through text-gray-400"
              }
            >
              {userData.points.totalEarned > 0
                ? "✅ Earned SUP points from Stack"
                : "1. Complete Stack tasks to earn SUP points"}
            </li>
            <li
              className={
                userData.fluidLocker.isCreated
                  ? "line-through text-gray-400"
                  : userData.points.totalEarned > 0
                  ? ""
                  : "text-gray-400"
              }
            >
              {userData.fluidLocker.isCreated
                ? "✅ Locker exists"
                : "2. Create FluidLocker (if needed)"}
            </li>
            <li
              className={
                userData.points.totalEarned > 0 &&
                userData.points.stackSignedData
                  ? ""
                  : "text-gray-400"
              }
            >
              3. Submit claim transaction
            </li>
            <li
              className={
                userData.points.totalEarned > 0 &&
                userData.points.stackSignedData
                  ? ""
                  : "text-gray-400"
              }
            >
              4. Receive SUP tokens in your locker
            </li>
          </ol>
        </div>

        {userData.fluidLocker.address && (
          <div className="mt-4 p-3 bg-blue-100 rounded text-xs">
            <strong>Your Locker:</strong>{" "}
            {(createdLockerAddress || userData.fluidLocker.address).slice(0, 6)}
            ...
            {(createdLockerAddress || userData.fluidLocker.address).slice(-4)}
          </div>
        )}
      </div>
    </div>
  );
}
