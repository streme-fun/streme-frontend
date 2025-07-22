"use client";

import { useState, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";

interface CheckinData {
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
}

export function useCheckin() {
  const [state, setState] = useState<CheckinState>({
    checkinData: null,
    isLoading: false,
    error: null,
    hasCheckedIn: false,
    hasAttempted: false,
  });

  const performCheckin = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, hasAttempted: true }));

    try {
      // Use the SDK's fetch method which automatically adds the Bearer token (same as SUP)
      const response = await sdk.quickAuth.fetch("/api/checkin", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const checkinData: CheckinData = await response.json();
      
      setState((prev) => ({
        ...prev,
        checkinData,
        isLoading: false,
        hasCheckedIn: true,
        hasAttempted: true,
      }));

      return checkinData;
    } catch (error) {
      console.error("Failed to perform checkin:", error);
      
      // Check if it's an already checked in error
      const errorMessage = error instanceof Error ? error.message : "Failed to perform checkin";
      const isAlreadyCheckedIn = errorMessage.toLowerCase().includes("already checked in");
      
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
    });
  }, []);

  return {
    ...state,
    performCheckin,
    autoCheckin,
    clearData,
  };
}