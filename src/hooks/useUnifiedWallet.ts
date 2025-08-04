"use client";

import { useAccount } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAppFrameLogic } from "./useAppFrameLogic";
import { useState, useEffect } from "react";

/**
 * Safe Privy hooks wrapper that handles mini-app mode
 */
function useSafePrivy() {
  try {
    return usePrivy();
  } catch {
    return { authenticated: false, login: () => {}, user: null };
  }
}

function useSafeWallets() {
  try {
    return useWallets();
  } catch {
    return { wallets: [] };
  }
}

/**
 * Unified wallet connection hook that handles all environments:
 * - Desktop: Privy authentication + wagmi connection
 * - Mobile: Privy authentication (primary) + wagmi connection (secondary)
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

  // Use safe Privy hooks that handle mini-app mode gracefully
  const { authenticated: privyAuthenticatedRaw, login: privyLogin, user: privyUser } = useSafePrivy();
  const { wallets } = useSafeWallets();
  
  // Only use Privy data when not in mini-app mode
  const privyAuthenticated = isMiniAppView ? false : privyAuthenticatedRaw;

  // Stable address management to prevent flickering
  const [stableAddress, setStableAddress] = useState<string>("");
  const [lastValidAddress, setLastValidAddress] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Determine if we're in a mini-app environment
  const isEffectivelyMiniApp = isMiniAppView;

  // Get the connected wallet address from Privy
  const connectedWallet = wallets.find(wallet => wallet.address) || wallets[0];
  const privyConnectedAddress = connectedWallet?.address;

  // Simplified connection logic
  // For mini-app: trust wagmi's useAccount() directly (uses farcasterMiniApp connector)
  // For regular apps: use Privy authentication + wagmi address
  const finalIsConnected = isEffectivelyMiniApp 
    ? wagmiIsConnected && Boolean(wagmiAddress)  // Ensure we have both connection and address
    : privyAuthenticated && Boolean(wagmiAddress || privyConnectedAddress);
    
  const rawAddress = isEffectivelyMiniApp 
    ? wagmiAddress
    : wagmiAddress || privyConnectedAddress;

  // Update stable address when we have a valid connection
  useEffect(() => {
    if (finalIsConnected && rawAddress && rawAddress !== lastValidAddress) {
      console.log("[useUnifiedWallet] Updating stable address:", {
        from: lastValidAddress,
        to: rawAddress,
        isConnected: finalIsConnected
      });
      setStableAddress(rawAddress);
      setLastValidAddress(rawAddress);
      setIsInitialized(true);
    } else if (!finalIsConnected && isInitialized) {
      // Only clear if we were previously connected (avoid initial empty state)
      console.log("[useUnifiedWallet] Clearing stable address - disconnected");
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
        if (farcasterConnect && farcasterConnectors && farcasterConnectors.length > 0) {
          const farcasterConnector = farcasterConnectors.find(c => c.id === 'farcasterMiniApp') || farcasterConnectors[0];
          farcasterConnect({ connector: farcasterConnector });
        } else {
          console.warn("Farcaster connect function not available");
        }
      }
    : privyLogin;

  // Loading states
  const isLoading = isEffectivelyMiniApp 
    ? !isSDKLoaded
    : false; // Privy doesn't have a loading state we need to wait for

  // The Farcaster mini-app connector should auto-connect if user has a wallet
  // We don't need to force connection - it should happen automatically

  // Debug logging for connection issues
  if (isEffectivelyMiniApp) {
    console.log("[useUnifiedWallet] Mini-app state:", {
      wagmiIsConnected,
      wagmiAddress,
      finalIsConnected,
      finalAddress,
      stableAddress,
      isSDKLoaded,
      farcasterIsConnected,
      farcasterAddress,
    });
  }

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
    raw: {
      wagmiAddress,
      wagmiIsConnected,
      privyAuthenticated,
      privyUserWalletAddress: privyUser?.wallet?.address,
      privyConnectedAddress,
      farcasterAddress,
      farcasterIsConnected,
      isMiniAppView,
      isSDKLoaded,
      stableAddress,
      lastValidAddress,
      rawAddress,
    }
  };
}