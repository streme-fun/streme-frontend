"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "./useAppFrameLogic";

/**
 * Unified wallet connection hook that handles all environments:
 * - Desktop: RainbowKit-managed wagmi connection
 * - Mobile web: RainbowKit-managed wagmi connection
 * - Mini-app: Farcaster wallet connection
 *
 * Provides stable address management to prevent flickering during navigation
 */
export function useUnifiedWallet() {
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();

  const {
    isMiniAppView,
    address: farcasterAddress,
    isConnected: farcasterIsConnected,
    connect: farcasterConnect,
    connectors: farcasterConnectors,
    isSDKLoaded,
  } = useAppFrameLogic();

  const { openConnectModal } = useConnectModal();

  // Stable address management to prevent flickering
  const [stableAddress, setStableAddress] = useState<string>("");
  const [lastValidAddress, setLastValidAddress] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Determine if we're in a mini-app environment
  const isEffectivelyMiniApp = isMiniAppView;

  // Debug logging for mini-app connection state (only when there's a mismatch) - disabled to reduce re-render noise
  // if (
  //   isEffectivelyMiniApp &&
  //   !wagmiIsConnected &&
  //   (wagmiAddress || farcasterAddress)
  // ) {
  //   console.log(
  //     "[useUnifiedWallet] Mini-app has address but wagmi not connected:",
  //     {
  //       wagmiIsConnected,
  //       wagmiAddress,
  //       farcasterAddress,
  //       isSDKLoaded,
  //     }
  //   );
  // }

  // Simplified connection logic
  // For mini-app: In Farcaster mini-apps, wagmi might not report "connected" but still have an address
  // For regular apps: rely on RainbowKit-managed wagmi state
  const finalIsConnected = isEffectivelyMiniApp
    ? Boolean(wagmiAddress || farcasterAddress) && isSDKLoaded // Trust address presence in mini-app
    : Boolean(wagmiAddress);

  const rawAddress = isEffectivelyMiniApp
    ? wagmiAddress || farcasterAddress
    : wagmiAddress;

  // Update stable address when we have a valid connection
  useEffect(() => {
    if (finalIsConnected && rawAddress && rawAddress !== lastValidAddress) {
      // console.log("[useUnifiedWallet] Updating stable address:", {
      //   from: lastValidAddress,
      //   to: rawAddress,
      //   isConnected: finalIsConnected,
      // });
      setStableAddress(rawAddress);
      setLastValidAddress(rawAddress);
      setIsInitialized(true);
    } else if (!finalIsConnected && isInitialized) {
      // Only clear if we were previously connected (avoid initial empty state)
      // console.log("[useUnifiedWallet] Clearing stable address - disconnected");
      setStableAddress("");
      setLastValidAddress("");
    } else if (!isInitialized && !finalIsConnected) {
      // Initial state - mark as initialized even if not connected
      setIsInitialized(true);
    }
  }, [finalIsConnected, rawAddress, lastValidAddress, isInitialized]);

  // Use stable address for public interface, but fall back to raw if stable is empty
  const finalAddress = stableAddress || rawAddress;

  const connect = isEffectivelyMiniApp
    ? () => {
        // For mini-apps, use the standard wagmi connect pattern
        if (
          farcasterConnect &&
          farcasterConnectors &&
          farcasterConnectors.length > 0
        ) {
          const farcasterConnector =
            farcasterConnectors.find((c) => c.id === "farcasterMiniApp") ||
            farcasterConnectors[0];
          farcasterConnect({ connector: farcasterConnector });
        } else {
          console.warn("Farcaster connect function not available");
        }
      }
    : () => {
        openConnectModal?.();
      };

  // Loading states
  const isLoading = isEffectivelyMiniApp ? !isSDKLoaded : false;

  // The Farcaster mini-app connector should auto-connect if user has a wallet
  // We don't need to force connection - it should happen automatically

  // Memoize the raw object to prevent unnecessary re-renders
  const rawStates = useMemo(
    () => ({
      wagmiAddress,
      wagmiIsConnected,
      farcasterAddress,
      farcasterIsConnected,
      isMiniAppView,
      isSDKLoaded,
      stableAddress,
      lastValidAddress,
      rawAddress,
    }),
    [
      wagmiAddress,
      wagmiIsConnected,
      farcasterAddress,
      farcasterIsConnected,
      isMiniAppView,
      isSDKLoaded,
      stableAddress,
      lastValidAddress,
      rawAddress,
    ]
  );

  return {
    // Connection state
    isConnected: finalIsConnected,
    address: finalAddress,

    // Actions
    connect,

    // Environment detection
    isEffectivelyMiniApp,

    // Loading state
    isLoading,

    // Stability indicators
    isStable: Boolean(stableAddress), // True when we have a stable address cached
    isInitialized,

    // Raw states for debugging/advanced usage
    raw: rawStates,
  };
}
