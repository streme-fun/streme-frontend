"use client";

import { useState, useEffect } from "react";
import { useFrame } from "../components/providers/FrameProvider";
import { useAccount, useConnect, useSwitchChain, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";
import type { Context as FarcasterContextType } from "@farcaster/miniapp-core";
import sdk from "@farcaster/miniapp-sdk";

// Global detection state to prevent multiple detection calls
const globalDetectionState: {
  isDetecting: boolean;
  isComplete: boolean;
  result: boolean;
  callbacks: ((result: boolean) => void)[];
} = {
  isDetecting: false,
  isComplete: false,
  result: false,
  callbacks: [],
};

export function useAppFrameLogic() {
  // Quick sync detection as initial fallback - be more conservative on localhost
  const quickDetection =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1") &&
    (window.parent !== window || window.location !== window.parent.location);

  const [isMiniAppView, setIsMiniAppView] = useState(
    globalDetectionState.isComplete ? globalDetectionState.result : quickDetection
  );
  const [isDetectionComplete, setIsDetectionComplete] = useState(globalDetectionState.isComplete);
  const [hasPromptedToAdd, setHasPromptedToAdd] = useState(false);
  const [hasAddedMiniApp, setHasAddedMiniApp] = useState(false);
  const { context: farcasterContext, isSDKLoaded } = useFrame();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  // Load mini app addition status from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasAdded = localStorage.getItem("streme-miniapp-added");
      if (hasAdded === "true") {
        setHasAddedMiniApp(true);
      }
    }
  }, []);

  // Enhanced mini app detection with proper timeout and fallback
  useEffect(() => {
    let detectionTimeoutId: NodeJS.Timeout;

    const detectMiniApp = async () => {
      try {
        // Check for any Farcaster client context (both Farcaster and Base App)
        // clientFid presence indicates we're in a mini-app context
        if (farcasterContext?.client?.clientFid) {
          console.log(`Mini-app detected with clientFid: ${farcasterContext.client.clientFid}`);
          setIsMiniAppView(true);
          setIsDetectionComplete(true);
          return;
        }

        // Note: sdk.isInMiniApp() is not currently supported in Base App (clientFid 309857)
        // but may work for other Farcaster clients, so try as fallback
        try {
          const isMiniApp = await sdk.isInMiniApp();
          console.log(`sdk.isInMiniApp() result: ${isMiniApp}`);
          setIsMiniAppView(isMiniApp);
          setIsDetectionComplete(true);
        } catch (sdkError) {
          console.warn("sdk.isInMiniApp() not supported, using fallback detection");
          // Use window-based fallback detection
          const fallbackDetection =
            typeof window !== "undefined" &&
            !window.location.hostname.includes("localhost") &&
            !window.location.hostname.includes("127.0.0.1") &&
            (window.parent !== window ||
              window.location !== window.parent.location);

          console.log(`Fallback detection result: ${fallbackDetection}`);
          setIsMiniAppView(fallbackDetection);
          setIsDetectionComplete(true);
        }
      } catch (error) {
        console.error("Error checking if in mini app:", error);

        // Try to detect based on window properties as fallback - be conservative on localhost
        const fallbackDetection =
          typeof window !== "undefined" &&
          !window.location.hostname.includes("localhost") &&
          !window.location.hostname.includes("127.0.0.1") &&
          (window.parent !== window ||
            window.location !== window.parent.location);

        console.log(`Final fallback detection result: ${fallbackDetection}`);
        setIsMiniAppView(fallbackDetection);
        setIsDetectionComplete(true);
      }
    };

    // Start detection immediately when component mounts, don't wait for isSDKLoaded
    // Also re-run when clientFid becomes available
    if (!isDetectionComplete || farcasterContext?.client?.clientFid) {
      // Add a small delay to let the SDK settle, but don't wait for full loading
      const initialDelay = setTimeout(() => {
        detectMiniApp();
      }, 100);

      // Add a timeout to ensure detection always completes
      detectionTimeoutId = setTimeout(() => {
        if (!isDetectionComplete) {
          const fallbackDetection =
            typeof window !== "undefined" &&
            !window.location.hostname.includes("localhost") &&
            !window.location.hostname.includes("127.0.0.1") &&
            (window.parent !== window ||
              window.location !== window.parent.location);
          setIsMiniAppView(fallbackDetection);
          setIsDetectionComplete(true);
        }
      }, 1000); // Reduced to 1 second for faster fallback

      return () => {
        clearTimeout(initialDelay);
        clearTimeout(detectionTimeoutId);
      };
    }

    return () => {
      if (detectionTimeoutId) {
        clearTimeout(detectionTimeoutId);
      }
    };
  }, [
    isDetectionComplete,
    farcasterContext?.client?.clientFid,
    farcasterContext,
    isSDKLoaded,
    quickDetection,
  ]);

  // Check if mini app is already added when context loads
  useEffect(() => {
    if (farcasterContext?.client) {
      const isAdded = farcasterContext.client.added;
      console.log("Mini app added status from context:", isAdded);

      if (isAdded) {
        setHasAddedMiniApp(true);
        // Also save to localStorage for consistency
        if (typeof window !== "undefined") {
          localStorage.setItem("streme-miniapp-added", "true");
        }
      }
    }
  }, [farcasterContext]);

  const isOnCorrectNetwork = isConnected && chain?.id === base.id;

  const promptToAddMiniApp = async () => {
    // Only prompt once per session
    if (hasPromptedToAdd) {
      console.log("Already prompted to add mini app this session");
      return;
    }

    setHasPromptedToAdd(true);

    try {
      console.log("Prompting user to add mini app...");
      const result = await sdk.actions.addFrame();

      console.log("Mini app successfully added!");

      // Mark as successfully added and save to localStorage
      setHasAddedMiniApp(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("streme-miniapp-added", "true");
      }

      if (result.notificationDetails) {
        console.log(
          "Notification details received:",
          result.notificationDetails
        );
        // You can store these details if you plan to send notifications later
      }
    } catch (error) {
      // Type assertion for error handling
      const err = error as { name?: string; message: string };
      if (
        err &&
        (err.name === "RejectedByUser" ||
          err.name === "InvalidDomainManifestJson")
      ) {
        console.log("Mini app not added:", err.message);
        if (err.name === "RejectedByUser") {
          console.log("User rejected the add frame request");
        } else if (err.name === "InvalidDomainManifestJson") {
          console.error(
            "Invalid domain manifest - check your farcaster.json file"
          );
        }
      } else {
        console.error(
          "Error prompting to add mini app:",
          err?.message || String(error)
        );
      }
    }
  };

  // Utility to safely get Ethereum provider with capability check
  const getSafeEthereumProvider = async () => {
    if (!isMiniAppView || !isSDKLoaded) {
      throw new Error("Not in Mini App context");
    }

    try {
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) {
        throw new Error("Ethereum provider not available");
      }
      return provider;
    } catch (error) {
      console.error("Failed to get Ethereum provider:", error);
      throw new Error("Wallet connection not available");
    }
  };

  return {
    isSDKLoaded: isDetectionComplete, // Only require detection to complete, not SDK loading
    isMiniAppView,
    farcasterContext: farcasterContext as
      | FarcasterContextType.MiniAppContext
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
    hasPromptedToAdd,
    hasAddedMiniApp,
    getSafeEthereumProvider,
  };
}
