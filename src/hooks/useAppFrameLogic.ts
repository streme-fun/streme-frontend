"use client";

import { useState, useEffect } from "react";
import { useFrame } from "../components/providers/FrameProvider"; // Assuming FrameProvider is in components/providers
import { useAccount, useConnect, useSwitchChain, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";
import type { Context as FarcasterContextType } from "@farcaster/frame-sdk";

export function useAppFrameLogic() {
  const [isMiniAppView, setIsMiniAppView] = useState(false);
  const { context: farcasterContext, isSDKLoaded } = useFrame();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  // Simple mini app detection based on context
  useEffect(() => {
    if (isSDKLoaded) {
      setIsMiniAppView(!!farcasterContext);
    }
  }, [isSDKLoaded, farcasterContext]);

  const isOnCorrectNetwork = isConnected && chain?.id === base.id;

  const promptToAddMiniApp = async () => {
    // This function is not used in the working version, keeping it for compatibility
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
    promptToAddMiniApp,
  };
}
