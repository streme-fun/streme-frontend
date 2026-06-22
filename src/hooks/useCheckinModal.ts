"use client";

import { useState, useEffect, useCallback } from "react";
import { useCheckin } from "./useCheckin";
import { useStremeFlowRate } from "./useStremeFlowRate";
import { useCheckinTracking } from "./useCheckinTracking";
import { CHECKIN_CONFIG } from "../constants/checkin";

interface UseCheckinModalProps {
  isMiniAppView: boolean;
  isConnected: boolean;
  isOnCorrectNetwork: boolean;
}

export function useCheckinModal({
  isMiniAppView,
  isConnected,
  isOnCorrectNetwork,
}: UseCheckinModalProps) {
  const [hasClosedCheckinModal, setHasClosedCheckinModal] = useState(false);
  
  const {
    performCheckin,
    checkinData,
    error: checkinError,
    isLoading: checkinLoading,
    showSuccessModal,
    closeSuccessModal,
    showCheckinModal,
    openCheckinModal,
    closeCheckinModal,
    markAsCheckedIn,
    showSuccessModalDebug,
    hasCheckedIn,
  } = useCheckin();
  
  const { trackModalAutoShown, trackDebugButtonClicked } = useCheckinTracking();
  
  const isDailyDropEnabled = CHECKIN_CONFIG.EXPERIMENTAL_DAILY_DROP_ENABLED;
  const { flowRate } = useStremeFlowRate(isDailyDropEnabled);
  const hasStakedBalance = flowRate !== "0" && flowRate !== undefined;
  
  // Custom close handler that remembers dismissal
  const handleCloseCheckinModal = useCallback(() => {
    setHasClosedCheckinModal(true);
    closeCheckinModal();
  }, [closeCheckinModal]);
  
  // Handle debug button click
  const handleDebugButtonClick = useCallback(() => {
    if (!isDailyDropEnabled) return;

    trackDebugButtonClicked(hasStakedBalance);
    openCheckinModal();
  }, [
    hasStakedBalance,
    isDailyDropEnabled,
    openCheckinModal,
    trackDebugButtonClicked,
  ]);
  
  // Auto-show checkin modal for eligible users
  useEffect(() => {
    const shouldAutoShow = 
      isDailyDropEnabled &&
      isMiniAppView &&
      isConnected &&
      isOnCorrectNetwork &&
      !hasCheckedIn &&
      !showCheckinModal &&
      !showSuccessModal &&
      !checkinLoading &&
      !hasClosedCheckinModal;
      
    if (shouldAutoShow) {
      const timer = setTimeout(() => {
        trackModalAutoShown(hasStakedBalance);
        openCheckinModal();
      }, CHECKIN_CONFIG.AUTO_SHOW_DELAY);
      
      return () => clearTimeout(timer);
    }
  }, [
    isMiniAppView,
    isDailyDropEnabled,
    isConnected,
    isOnCorrectNetwork,
    hasCheckedIn,
    showCheckinModal,
    showSuccessModal,
    checkinLoading,
    openCheckinModal,
    hasClosedCheckinModal,
    hasStakedBalance,
    trackModalAutoShown,
  ]);
  
  return {
    // State
    checkinData,
    checkinError,
    checkinLoading,
    showSuccessModal: isDailyDropEnabled && showSuccessModal,
    showCheckinModal: isDailyDropEnabled && showCheckinModal,
    hasCheckedIn: isDailyDropEnabled ? hasCheckedIn : true,
    hasStakedBalance,
    
    // Actions
    performCheckin,
    closeSuccessModal,
    handleCloseCheckinModal,
    handleDebugButtonClick,
    showSuccessModalDebug,
    markAsCheckedIn,
    setShowCheckinModal: openCheckinModal,
  };
}
