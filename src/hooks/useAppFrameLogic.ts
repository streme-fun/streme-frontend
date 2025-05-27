"use client";

import { useState, useEffect } from "react";
import { useFrame } from "../components/providers/FrameProvider"; // Assuming FrameProvider is in components/providers
import { useAccount, useConnect, useSwitchChain, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";
import type { Context as FarcasterContextType } from "@farcaster/frame-sdk";
import { sdk } from "@farcaster/frame-sdk"; // Added SDK import

export function useAppFrameLogic() {
  const [isMiniAppView, setIsMiniAppView] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { context: farcasterContext, isSDKLoaded } = useFrame();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (isSDKLoaded) {
      setIsMiniAppView(!!farcasterContext);
    }
  }, [farcasterContext, isSDKLoaded]);

  // Call ready when the interface is ready to be displayed
  useEffect(() => {
    if (isSDKLoaded && isMiniAppView && !isReady) {
      const callReady = async () => {
        try {
          await sdk.actions.ready();
          setIsReady(true);
        } catch (error) {
          console.error("Error calling sdk.actions.ready():", error);
          setIsReady(true); // Set ready anyway to prevent blocking
        }
      };

      callReady();
    } else if (!isMiniAppView) {
      setIsReady(true);
    }
  }, [isSDKLoaded, isMiniAppView, isReady]);

  const isOnCorrectNetwork = isConnected && chain?.id === base.id;

  const promptToAddMiniApp = async () => {
    if (isSDKLoaded && isMiniAppView) {
      try {
        await sdk.actions.addMiniApp();
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.message === "AddMiniApp.InvalidDomainManifest"
        ) {
          // Do nothing, ignore this specific error
        } else {
          console.error("Error prompting to add mini app:", error);
        }
      }
    }
  };

  return {
    isSDKLoaded,
    isMiniAppView,
    farcasterContext: farcasterContext as
      | FarcasterContextType.FrameContext
      | undefined,
    address,
    isConnected,
    chain,
    isOnCorrectNetwork,
    isReady,
    connect,
    connectors,
    switchChain,
    isSwitchingChain,
    disconnect,
    promptToAddMiniApp, // Exposed the new function
  };
}
