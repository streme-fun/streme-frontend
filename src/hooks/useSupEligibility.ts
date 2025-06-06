"use client";

import { useState, useCallback } from "react";

interface EligibilityData {
  pointSystemId: number;
  pointSystemName: string;
  eligible: boolean;
  points: number;
  claimedAmount: number;
  needToClaim: boolean;
  gdaPoolAddress: string;
  estimatedFlowRate: string;
}

interface SupEligibilityResult {
  address: string;
  hasAllocations: boolean;
  claimNeeded: boolean;
  totalFlowRate: string;
  eligibility: EligibilityData[];
}

interface SupEligibilityState {
  eligibilityData: SupEligibilityResult | null;
  isLoading: boolean;
  error: string | null;
}

export function useSupEligibility() {
  const [state, setState] = useState<SupEligibilityState>({
    eligibilityData: null,
    isLoading: false,
    error: null,
  });

  const fetchEligibility = useCallback(async (address: string) => {
    if (!address) {
      setState((prev) => ({
        ...prev,
        error: "No address provided",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/sup/eligibility?address=${address}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const eligibilityData: SupEligibilityResult = await response.json();

      setState((prev) => ({
        ...prev,
        eligibilityData,
        isLoading: false,
      }));

      return eligibilityData;
    } catch (error) {
      console.error("Failed to fetch SUP eligibility:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch SUP eligibility",
      }));
      throw error;
    }
  }, []);

  const clearData = useCallback(() => {
    setState({
      eligibilityData: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Helper function to get total flow rate formatted
  const getFormattedFlowRate = useCallback(() => {
    if (!state.eligibilityData?.totalFlowRate) return "0";

    const flowRate = parseFloat(state.eligibilityData.totalFlowRate);
    if (flowRate === 0) return "0";

    // Convert from wei per second to a more readable format
    // Assuming 18 decimals for SUP token
    const tokensPerSecond = flowRate / 1e18;
    const tokensPerDay = tokensPerSecond * 86400;

    if (tokensPerDay < 0.01) {
      return `${tokensPerSecond.toFixed(8)} SUP/s`;
    } else {
      return `${tokensPerDay.toFixed(4)} SUP/day`;
    }
  }, [state.eligibilityData]);

  return {
    ...state,
    fetchEligibility,
    clearData,
    getFormattedFlowRate,
  };
}
