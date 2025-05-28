"use client";

import { useState, useEffect } from "react";
import { useFrame } from "../components/providers/FrameProvider";
import { useAccount, useConnect, useSwitchChain, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";
import type { Context as FarcasterContextType } from "@farcaster/frame-sdk";
import { sdk } from "@farcaster/frame-sdk";

export function useAppFrameLogic() {
  const [isMiniAppView, setIsMiniAppView] = useState(false);
  const [isDetectionComplete, setIsDetectionComplete] = useState(false);
  const { context: farcasterContext, isSDKLoaded } = useFrame();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  // Enhanced mini app detection with proper timeout and fallback
  useEffect(() => {
    const detectMiniApp = async () => {
      try {
        // Wait for SDK to be properly loaded
        if (!isSDKLoaded) {
          return;
        }

        // Use the official detection method
        const isMiniApp = await sdk.isInMiniApp();

        console.log("Mini app detection result:", {
          isMiniApp,
          hasContext: !!farcasterContext,
        });

        setIsMiniAppView(isMiniApp);
        setIsDetectionComplete(true);
      } catch (error) {
        console.error("Error checking if in mini app:", error);

        // If detection fails, default to false
        setIsMiniAppView(false);
        setIsDetectionComplete(true);
      }
    };

    // Add a timeout to ensure detection completes even if SDK detection fails
    const detectionTimeoutId = setTimeout(() => {
      if (isSDKLoaded && !isDetectionComplete) {
        console.log("Mini app detection timeout - defaulting to false");
        setIsMiniAppView(false);
        setIsDetectionComplete(true);
      }
    }, 2000); // 2 second timeout for detection

    // Only run detection when SDK is loaded
    if (isSDKLoaded && !isDetectionComplete) {
      detectMiniApp();
    }

    return () => {
      clearTimeout(detectionTimeoutId);
    };
  }, [isSDKLoaded, farcasterContext, isDetectionComplete]);

  const isOnCorrectNetwork = isConnected && chain?.id === base.id;

  const promptToAddMiniApp = async () => {
    // This function is not used in the working version, keeping it for compatibility
  };

  return {
    isSDKLoaded: isSDKLoaded && isDetectionComplete,
    isMiniAppView,
    farcasterContext: farcasterContext as
      | FarcasterContextType.FrameContext
      | undefined,
    address,
    isConnected,
    chain,
    isOnCorrectNetwork,
    connect,
    connectors,
    switchChain,
    isSwitchingChain,
    disconnect,
    promptToAddMiniApp,
  };
}
