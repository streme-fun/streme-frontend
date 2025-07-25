"use client";

import { useState, useMemo, useEffect } from "react";
import { CheckinData } from "../hooks/useCheckin";
import { useCheckinTracking } from "../hooks/useCheckinTracking";
import { CHECKIN_MESSAGES, BUTTON_TEXT } from "../constants/checkin";
import { CheckinAnimation } from "./CheckinAnimation";

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
  const { trackModalShown, trackClaimClicked, trackModalClosed } =
    useCheckinTracking();

  // Select random message for staked users
  const selectedMessage = useMemo(() => {
    const randomIndex = Math.floor(
      Math.random() * CHECKIN_MESSAGES.STAKED_USERS.length
    );
    return CHECKIN_MESSAGES.STAKED_USERS[randomIndex];
  }, []);

  // Track modal shown event
  useEffect(() => {
    if (isOpen) {
      trackModalShown(hasStakedBalance, hasCheckedIn);
    }
  }, [isOpen, hasStakedBalance, hasCheckedIn, trackModalShown]);

  const handleCheckin = async () => {
    setIsProcessing(true);

    // Track claim button click
    const messageShown = hasStakedBalance
      ? selectedMessage
      : CHECKIN_MESSAGES.NEW_USER;
    trackClaimClicked(hasStakedBalance, messageShown);

    try {
      await onCheckin();
      onClose();
    } catch {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    trackModalClosed(hasStakedBalance, hasCheckedIn, !hasCheckedIn);
    onClose();
  };

  if (!isOpen) return null;

  const displayMessage = hasStakedBalance
    ? selectedMessage
    : CHECKIN_MESSAGES.NEW_USER;
  const isButtonDisabled = isProcessing || isLoading || hasCheckedIn;
  const buttonText = getButtonText(isProcessing, isLoading, hasCheckedIn);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-0"
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

        <button
          onClick={handleCheckin}
          disabled={isButtonDisabled}
          className="btn btn-lg btn-primary w-full"
        >
          {buttonText}
        </button>
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
