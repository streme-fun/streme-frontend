"use client";

import { useState, useEffect } from "react";
import { useFrame } from "../components/providers/FrameProvider"; // Assuming FrameProvider is in components/providers
import { useAccount, useConnect, useSwitchChain, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";
import type { Context as FarcasterContextType } from "@farcaster/frame-sdk";
import { sdk } from "@farcaster/frame-sdk"; // Added SDK import

export function useAppFrameLogic() {
  const [isMiniAppView, setIsMiniAppView] = useState(false);
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
    connect,
    connectors,
    switchChain,
    isSwitchingChain,
    disconnect,
    promptToAddMiniApp, // Exposed the new function
  };
}
