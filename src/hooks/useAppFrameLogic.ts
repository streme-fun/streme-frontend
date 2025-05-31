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
  const [hasPromptedToAdd, setHasPromptedToAdd] = useState(false);
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
    hasPromptedToAdd,
  };
}
