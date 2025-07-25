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
    showSuccessModalDebug,
    hasCheckedIn,
  } = useCheckin();
  
  const { flowRate } = useStremeFlowRate();
  const { trackModalAutoShown, trackDebugButtonClicked } = useCheckinTracking();
  
  const hasStakedBalance = flowRate !== "0" && flowRate !== undefined;
  
  // Custom close handler that remembers dismissal
  const handleCloseCheckinModal = useCallback(() => {
    setHasClosedCheckinModal(true);
    closeCheckinModal();
  }, [closeCheckinModal]);
  
  // Handle debug button click
  const handleDebugButtonClick = useCallback(() => {
    trackDebugButtonClicked(hasStakedBalance);
    openCheckinModal();
  }, [hasStakedBalance, openCheckinModal, trackDebugButtonClicked]);
  
  // Auto-show checkin modal for eligible users - DISABLED FOR NOW
  useEffect(() => {
    // Temporarily disabled auto-show functionality
    return;
    
    const shouldAutoShow = 
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
    showSuccessModal,
    showCheckinModal,
    hasCheckedIn,
    hasStakedBalance,
    
    // Actions
    performCheckin,
    closeSuccessModal,
    handleCloseCheckinModal,
    handleDebugButtonClick,
    showSuccessModalDebug,
    setShowCheckinModal: openCheckinModal,
  };
}