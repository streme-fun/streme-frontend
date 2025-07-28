"use client";

import { useState, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { toast } from "sonner";

export interface CheckinData {
  success: boolean;
  fid: number;
  wallet: string;
  checkinDate: string;
  totalCheckins: number;
  currentStreak: number;
  dropAmount: string;
  dropTxHash?: string;
  error?: string;
}

interface CheckinState {
  checkinData: CheckinData | null;
  isLoading: boolean;
  error: string | null;
  hasCheckedIn: boolean;
  hasAttempted: boolean;
  showSuccessModal: boolean;
  showCheckinModal: boolean;
}

export function useCheckin() {
  const [state, setState] = useState<CheckinState>({
    checkinData: null,
    isLoading: false,
    error: null,
    hasCheckedIn: false,
    hasAttempted: false,
    showSuccessModal: false,
    showCheckinModal: false,
  });

  const performCheckin = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      hasAttempted: true,
    }));

    const toastId = toast.loading("Claiming...");

    try {
      // Use the SDK's fetch method which automatically adds the Bearer token (same as SUP)
      const response = await sdk.quickAuth.fetch("/api/checkin", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const checkinData: CheckinData = await response.json();

      setState((prev) => ({
        ...prev,
        checkinData,
        isLoading: false,
        hasCheckedIn: true,
        hasAttempted: true,
        showSuccessModal: true, // Show modal immediately
      }));

      // Show success toast with message
      const toastMessage = checkinData.dropAmount
        ? `${checkinData.dropAmount} stStreme has been sent to your wallet.`
        : `Daily Drop Claimed!`;

      toast.success(toastMessage, {
        id: toastId,
        duration: 10000,
      });

      return checkinData;
    } catch (error) {
      console.error("Failed to perform checkin:", error);

      // Check if it's an already checked in error
      const errorMessage =
        error instanceof Error ? error.message : "Failed to perform checkin";
      const isAlreadyCheckedIn = errorMessage
        .toLowerCase()
        .includes("already checked in");

      toast.error(errorMessage, { id: toastId });

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        hasCheckedIn: isAlreadyCheckedIn,
        hasAttempted: true,
      }));

      throw error;
    }
  }, []);

  // Auto-checkin on mount
  const autoCheckin = useCallback(async () => {
    // Only auto-checkin if we haven't already attempted
    if (!state.hasAttempted && !state.isLoading) {
      try {
        await performCheckin();
      } catch (error) {
        // Silently handle errors for auto-checkin
        console.log("Auto-checkin failed:", error);
      }
    }
  }, [performCheckin, state.hasAttempted, state.isLoading]);

  const clearData = useCallback(() => {
    setState({
      checkinData: null,
      isLoading: false,
      error: null,
      hasCheckedIn: false,
      hasAttempted: false,
      showSuccessModal: false,
      showCheckinModal: false,
    });
  }, []);

  const closeSuccessModal = useCallback(() => {
    setState((prev) => ({ ...prev, showSuccessModal: false }));
  }, []);

  const openCheckinModal = useCallback(() => {
    setState((prev) => ({ ...prev, showCheckinModal: true }));
  }, []);

  const closeCheckinModal = useCallback(() => {
    setState((prev) => ({ ...prev, showCheckinModal: false }));
  }, []);

  const showSuccessModalDebug = useCallback(() => {
    const fakeCheckinData: CheckinData = {
      success: true,
      fid: 446697,
      wallet: "0x1234...5678",
      checkinDate: new Date().toISOString(),
      totalCheckins: 7,
      currentStreak: 3,
      dropAmount: "10",
    };

    setState((prev) => ({
      ...prev,
      checkinData: fakeCheckinData,
      showSuccessModal: true, // Show modal immediately
      hasCheckedIn: true,
    }));

    // Show the toast
    const toastMessage = `1000 stStreme has been sent to your wallet.`;

    toast.success(toastMessage, {
      duration: 10000,
    });
  }, []);

  return {
    ...state,
    performCheckin,
    autoCheckin,
    clearData,
    closeSuccessModal,
    openCheckinModal,
    closeCheckinModal,
    showSuccessModalDebug,
  };
}
