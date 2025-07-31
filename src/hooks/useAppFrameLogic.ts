"use client";

import { useState, useEffect } from "react";
import { useFrame } from "../components/providers/FrameProvider";
import { useAccount, useConnect, useSwitchChain, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";
import type { Context as FarcasterContextType } from "@farcaster/miniapp-core";
import sdk from "@farcaster/miniapp-sdk";

export function useAppFrameLogic() {
  const [isMiniAppView, setIsMiniAppView] = useState(false);
  const [isDetectionComplete, setIsDetectionComplete] = useState(false);
  const [hasPromptedToAdd, setHasPromptedToAdd] = useState(false);
  const [hasAddedMiniApp, setHasAddedMiniApp] = useState(false);
  const { context: farcasterContext, isSDKLoaded } = useFrame();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  // Enhanced mini app detection with proper timeout and fallback
  useEffect(() => {
    const detectMiniApp = async () => {
      try {
        console.log("Starting mini-app detection...");
        console.log("farcasterContext:", farcasterContext);
        console.log("clientFid:", farcasterContext?.client?.clientFid);

        // Check for Base App clientFid first (most reliable when available)
        if (farcasterContext?.client?.clientFid === 309857) {
          console.log("Base App detected via clientFid 309857");
          setIsMiniAppView(true);
          setIsDetectionComplete(true);
          return;
        }

        // Check for any other Farcaster client context
        if (farcasterContext?.client?.clientFid) {
          console.log(
            `Other Farcaster client detected with clientFid: ${farcasterContext.client.clientFid}`
          );
          setIsMiniAppView(true);
          setIsDetectionComplete(true);
          return;
        }

        // Try SDK detection for other Farcaster clients
        try {
          const isMiniApp = await sdk.isInMiniApp();
          console.log(`sdk.isInMiniApp() result: ${isMiniApp}`);
          setIsMiniAppView(isMiniApp);
          setIsDetectionComplete(true);
        } catch {
          console.warn("sdk.isInMiniApp() not supported");
          // Final fallback - assume not mini-app if nothing else worked
          console.log("No mini-app detected, using desktop mode");
          setIsMiniAppView(false);
          setIsDetectionComplete(true);
        }
      } catch (error) {
        console.error("Error checking if in mini app:", error);
        setIsMiniAppView(false);
        setIsDetectionComplete(true);
      }
    };

    // Start detection immediately when component mounts, don't wait for isSDKLoaded
    // Also re-run when clientFid becomes available
    if (!isDetectionComplete || farcasterContext?.client?.clientFid) {
      detectMiniApp();
    }

    return () => {};
  }, [
    isDetectionComplete,
    farcasterContext?.client?.clientFid,
    farcasterContext,
    isSDKLoaded,
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
