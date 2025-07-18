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
  // Try to find any connected wallet, not just 'privy' client type
  const connectedWallet = wallets.find(wallet => wallet.address) || wallets[0];
  const privyConnectedAddress = connectedWallet?.address;


  // Unified connection logic - match navbar approach
  // For mobile, prioritize Privy authentication even if mini-app detection is confused
  const isConnected = isEffectivelyMiniApp 
    ? farcasterIsConnected
    : privyAuthenticated;

  const address = isEffectivelyMiniApp 
    ? farcasterAddress 
    : wagmiAddress || privyConnectedAddress;

  // Safety fallback: if we think we're in mini-app but have no farcaster connection
  // but DO have privy authentication, use privy instead
  const hasFarcasterConnection = farcasterIsConnected && farcasterAddress;
  const hasPrivyConnection = privyAuthenticated && (wagmiAddress || privyConnectedAddress);
  
  const finalIsConnected = isEffectivelyMiniApp 
    ? (hasFarcasterConnection || (!hasFarcasterConnection && hasPrivyConnection))
    : privyAuthenticated;
    
  const finalAddress = isEffectivelyMiniApp 
    ? (farcasterAddress || (!hasFarcasterConnection && hasPrivyConnection ? (wagmiAddress || privyConnectedAddress) : undefined))
    : wagmiAddress || privyConnectedAddress;

  const connect = isEffectivelyMiniApp
    ? () => {
        if (farcasterConnect && farcasterConnectors && farcasterConnectors.length > 0) {
          farcasterConnect({ connector: farcasterConnectors[0] });
        } else {
          console.warn("Farcaster connect function not available");
        }
      }
    : privyLogin;

  // Loading states
  const isLoading = isEffectivelyMiniApp 
    ? !isSDKLoaded
    : false; // Privy doesn't have a loading state we need to wait for

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
      // Debugging values
      originalIsConnected: isConnected,
      originalAddress: address,
      hasFarcasterConnection,
      hasPrivyConnection,
    }
  };
}