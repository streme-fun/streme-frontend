"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import { CheckinData } from "../hooks/useCheckin";
import { useCheckinTracking } from "../hooks/useCheckinTracking";
import { CHECKIN_MESSAGES, BUTTON_TEXT } from "../constants/checkin";
import { CheckinAnimation } from "./CheckinAnimation";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { publicClient } from "../lib/viemClient";
import { StakeAllButton } from "./StakeAllButton";

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckin: () => Promise<CheckinData>;
  isLoading?: boolean;
  hasCheckedIn?: boolean;
  hasStakedBalance?: boolean;
}

export function CheckinModal({
  isOpen,
  onClose,
  onCheckin,
  isLoading = false,
  hasCheckedIn = false,
  hasStakedBalance = false,
}: CheckinModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stremeBalance, setStremeBalance] = useState<bigint>(0n);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const { trackModalShown, trackClaimClicked, trackModalClosed } =
    useCheckinTracking();

  // Get effective connection state and address
  const {
    isMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
  } = useAppFrameLogic();
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();

  const effectiveIsConnected = isMiniAppView ? fcIsConnected : wagmiIsConnected;
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  // STREME token address and staking pool
  const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
  const STREME_STAKING_POOL = "0xa040a8564c433970d7919c441104b1d25b9eaa1c";

  // Check if user has STREME balance (but not staked)
  const hasStremeBalance = stremeBalance > 0n;

  // Determine the user state
  const userState = useMemo(() => {
    if (hasStakedBalance && hasStremeBalance) return "stakedWithBalance";
    if (hasStakedBalance && !hasStremeBalance) return "stakedNoBalance";
    if (!hasStakedBalance && hasStremeBalance) return "needsToStake";
    return "new";
  }, [hasStakedBalance, hasStremeBalance]);

  // Select random message based on user state
  const selectedMessage = useMemo(() => {
    if (userState === "stakedWithBalance") {
      const randomIndex = Math.floor(
        Math.random() * CHECKIN_MESSAGES.STAKED_USERS_WITH_BALANCE.length
      );
      return CHECKIN_MESSAGES.STAKED_USERS_WITH_BALANCE[randomIndex];
    } else if (userState === "stakedNoBalance") {
      const randomIndex = Math.floor(
        Math.random() * CHECKIN_MESSAGES.STAKED_USERS_NO_BALANCE.length
      );
      return CHECKIN_MESSAGES.STAKED_USERS_NO_BALANCE[randomIndex];
    }
    return "";
  }, [userState]);

  // Fetch STREME balance when modal opens
  useEffect(() => {
    const fetchStremeBalance = async () => {
      // Only log when modal is actually open and we're about to fetch
      if (!effectiveIsConnected || !effectiveAddress || !isOpen) return;

      console.log("CheckinModal: Fetching STREME balance", {
        address: effectiveAddress,
        isMiniApp: isMiniAppView,
      });

      setIsCheckingBalance(true);
      try {
        const balance = await publicClient.readContract({
          address: STREME_TOKEN_ADDRESS as `0x${string}`,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [effectiveAddress as `0x${string}`],
        });
        const balanceResult = balance as bigint;
        console.log("CheckinModal: STREME balance fetched", {
          address: effectiveAddress,
          balance: balanceResult.toString(),
          balanceFormatted: (Number(balanceResult) / 1e18).toFixed(4),
        });
        setStremeBalance(balanceResult);
      } catch (error) {
        console.error("Error fetching STREME balance:", error);
        setStremeBalance(0n);
      } finally {
        setIsCheckingBalance(false);
      }
    };

    fetchStremeBalance();
  }, [effectiveIsConnected, effectiveAddress, isOpen, STREME_TOKEN_ADDRESS]);

  // Track modal shown event
  useEffect(() => {
    if (isOpen) {
      trackModalShown(hasStakedBalance, hasCheckedIn);
    }
  }, [isOpen, hasStakedBalance, hasCheckedIn, trackModalShown]);

  const handleCheckin = async () => {
    setIsProcessing(true);

    // Track claim button click
    const messageShown = getDisplayMessage();
    trackClaimClicked(hasStakedBalance, messageShown);

    try {
      await onCheckin();
      onClose();
    } catch {
      setIsProcessing(false);
    }
  };

  const handleStakeSuccess = async () => {
    console.log("CheckinModal: Stake successful, starting auto-claim process");
    try {
      // Refresh balance after successful staking
      setStremeBalance(0n); // Reset since they just staked it all

      // Automatically trigger the claim after successful staking
      console.log("CheckinModal: Triggering onCheckin for auto-claim");
      await onCheckin();

      // Close the modal - the success modal will show automatically
      console.log("CheckinModal: Auto-claim successful, closing modal");
      onClose();
    } catch (error) {
      console.error("Auto-claim after staking failed:", error);
      // If auto-claim fails, just update the UI to show the claim button
      // The user can manually claim
    }
  };

  const getDisplayMessage = () => {
    switch (userState) {
      case "stakedWithBalance":
        return selectedMessage;
      case "stakedNoBalance":
        return selectedMessage;
      case "needsToStake":
        return CHECKIN_MESSAGES.NEED_TO_STAKE;
      case "new":
      default:
        return CHECKIN_MESSAGES.NEW_USER;
    }
  };

  const handleClose = () => {
    trackModalClosed(hasStakedBalance, hasCheckedIn, !hasCheckedIn);
    onClose();
  };

  if (!isOpen) return null;

  const displayMessage = getDisplayMessage();
  const showStakeButton =
    (userState === "stakedWithBalance" || userState === "needsToStake") &&
    !hasCheckedIn;
  const showClaimButton =
    (userState === "stakedNoBalance" || userState === "new") &&
    !isCheckingBalance;

  const isClaimButtonDisabled = isProcessing || isLoading || hasCheckedIn;
  const claimButtonText = getButtonText(isProcessing, isLoading, hasCheckedIn);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100] p-0"
      onClick={handleClose}
    >
      <div
        className="bg-base-100 rounded-t-2xl p-6 max-w-sm w-full text-center relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animation at the top */}
        <div className="mb-4">
          <CheckinAnimation />
        </div>

        <h2 className="text-base font-bold mb-4">
          {CHECKIN_MESSAGES.MODAL_TITLE}
        </h2>

        <p className="text-base text-base-content mb-6 whitespace-pre-line">
          {displayMessage}
        </p>

        {isCheckingBalance && (
          <div className="mb-6">
            <span className="loading loading-spinner loading-sm"></span>
            <span className="ml-2 text-sm">Checking balance...</span>
          </div>
        )}

        {showStakeButton && (
          <StakeAllButton
            tokenAddress={STREME_TOKEN_ADDRESS}
            stakingPoolAddress={STREME_STAKING_POOL}
            symbol="STREME"
            tokenBalance={stremeBalance}
            isMiniApp={isMiniAppView}
            farcasterAddress={effectiveAddress as string}
            farcasterIsConnected={effectiveIsConnected}
            onSuccess={handleStakeSuccess}
            className="btn btn-lg btn-primary w-full"
            buttonText={BUTTON_TEXT.STAKE}
          />
        )}

        {showClaimButton && (
          <button
            onClick={handleCheckin}
            disabled={isClaimButtonDisabled}
            className="btn btn-lg btn-primary w-full"
          >
            {claimButtonText}
          </button>
        )}

        {hasCheckedIn && !showStakeButton && !showClaimButton && (
          <button disabled className="btn btn-lg btn-primary w-full">
            {BUTTON_TEXT.ALREADY_CLAIMED}
          </button>
        )}
      </div>
    </div>
  );
}

// Helper function for button text
function getButtonText(
  isProcessing: boolean,
  isLoading: boolean,
  hasCheckedIn: boolean
): React.ReactNode {
  if (isProcessing || isLoading) {
    return (
      <>
        <span className="loading loading-spinner loading-sm"></span>
        {BUTTON_TEXT.CLAIMING}
      </>
    );
  }

  if (hasCheckedIn) {
    return BUTTON_TEXT.ALREADY_CLAIMED;
  }

  return BUTTON_TEXT.CLAIM;
}
