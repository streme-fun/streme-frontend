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

        // Use the official detection method with a reasonable timeout
        const isMiniApp = await sdk.isInMiniApp(); // Official method without parameters

        console.log("Mini app detection result:", {
          isMiniApp,
          hasContext: !!farcasterContext,
          userAgent: navigator.userAgent,
          isInIframe: window !== window.parent,
        });

        setIsMiniAppView(isMiniApp);
        setIsDetectionComplete(true);
      } catch (error) {
        console.error("Error checking if in mini app:", error);

        // Enhanced fallback detection for mobile wallet browsers
        const isInIframe = window !== window.parent;
        const isMobileWallet =
          /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) &&
          (window.location !== window.parent.location || isInIframe);
        const hasValidContext = !!farcasterContext;

        // Consider it a mini app if we have a valid context OR if we're in a mobile iframe
        const fallbackResult =
          hasValidContext || (isMobileWallet && isInIframe);

        console.log("Fallback mini app detection:", {
          fallbackResult,
          isInIframe,
          isMobileWallet,
          hasValidContext,
          userAgent: navigator.userAgent,
        });

        setIsMiniAppView(fallbackResult);
        setIsDetectionComplete(true);
      }
    };

    // Only run detection when SDK is loaded
    if (isSDKLoaded && !isDetectionComplete) {
      detectMiniApp();
    }
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
