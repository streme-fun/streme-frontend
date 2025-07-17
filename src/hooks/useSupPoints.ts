"use client";

import { useState, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";

interface UserPointsData {
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
}

interface SupPointsState {
  userData: UserPointsData | null;
  isLoading: boolean;
  error: string | null;
}

export function useSupPoints() {
  const [state, setState] = useState<SupPointsState>({
    userData: null,
    isLoading: false,
    error: null,
  });

  const fetchUserData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use the SDK's fetch method which automatically adds the Bearer token
      const response = await sdk.quickAuth.fetch("/api/sup/points");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const userData: UserPointsData = await response.json();

      setState((prev) => ({
        ...prev,
        userData,
        isLoading: false,
      }));

      return userData;
    } catch (error) {
      console.error("Failed to fetch user points:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch user points",
      }));
      throw error;
    }
  }, []);

  const clearData = useCallback(() => {
    setState({
      userData: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    fetchUserData,
    clearData,
  };
}