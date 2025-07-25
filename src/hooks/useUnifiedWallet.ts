"use client";

import { useAccount } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAppFrameLogic } from "./useAppFrameLogic";

/**
 * Unified wallet connection hook that handles all environments:
 * - Desktop: Privy authentication + wagmi connection
 * - Mobile: Privy authentication (primary) + wagmi connection (secondary)
 * - Mini-app: Farcaster wallet connection
 */
export function useUnifiedWallet() {
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();
  const { authenticated: privyAuthenticated, login: privyLogin, user: privyUser } = usePrivy();
  const { wallets } = useWallets();
  
  const {
    isMiniAppView,
    address: farcasterAddress,
    isConnected: farcasterIsConnected,
    connect: farcasterConnect,
    connectors: farcasterConnectors,
    isSDKLoaded,
  } = useAppFrameLogic();

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
    
  const finalAddress = isEffectivelyMiniApp 
    ? wagmiAddress
    : wagmiAddress || privyConnectedAddress;

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
    }
  };
}