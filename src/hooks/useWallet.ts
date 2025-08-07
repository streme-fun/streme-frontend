"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useMiniAppContext } from "../contexts/MiniAppContext";
import { useCallback, useEffect } from "react";
import {
  useSafePrivy,
  useSafeWallets,
  useSafeSetActiveWallet,
} from "./useSafePrivy";

/**
 * Simplified wallet hook that provides a clean interface for wallet connections
 * across both browser and mini-app contexts.
 *
 * In mini-app: Uses wagmi directly with Farcaster connector
 * In browser: Uses Privy for auth + wagmi for blockchain interactions
 */
export function useWallet() {
  const { address, isConnected: wagmiIsConnected, connector } = useAccount();
  const { connect: wagmiConnect, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const {
    authenticated,
    login: privyLogin,
    logout: privyLogout,
  } = useSafePrivy();
  const { wallets } = useSafeWallets();
  const { setActiveWallet } = useSafeSetActiveWallet();
  const isMiniApp = useMiniAppContext();

  // Get the active wallet from Privy
  // In Privy + wagmi setup, the first wallet is typically the active one
  const activeWallet = wallets[0];

  // Handle wallet changes in browser mode
  useEffect(() => {
    if (!isMiniApp && authenticated && wallets.length > 0) {
      // If wagmi address doesn't match any Privy wallet, sync them
      const hasMatchingWallet = wallets.some(
        (w) => w.address?.toLowerCase() === address?.toLowerCase()
      );

      if (!hasMatchingWallet && address) {
        // Browser extension wallet changed outside of Privy
        // Try to find and set the new wallet as active
        const newWallet = wallets.find(
          (w) => w.address?.toLowerCase() === address?.toLowerCase()
        );
        if (newWallet) {
          setActiveWallet(newWallet);
        }
      } else if (!address && activeWallet) {
        // Wagmi lost connection but Privy still has a wallet
        // Try to reconnect
        setActiveWallet(activeWallet);
      }
    }
  }, [
    isMiniApp,
    authenticated,
    wallets,
    address,
    activeWallet,
    setActiveWallet,
  ]);

  // Listen for account changes from the browser wallet
  useEffect(() => {
    if (
      !isMiniApp &&
      typeof window !== "undefined" &&
      (window as Window & { ethereum?: unknown }).ethereum
    ) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log("Wallet accounts changed:", accounts);

        if (accounts.length === 0) {
          // Wallet disconnected
          privyLogout();
        } else if (accounts[0]?.toLowerCase() !== address?.toLowerCase()) {
          // Account changed - need to update Privy
          // Force a reconnection with the new account
          const newAddress = accounts[0];
          const newWallet = wallets.find(
            (w) => w.address?.toLowerCase() === newAddress.toLowerCase()
          );

          if (newWallet) {
            // Wallet already connected in Privy, just set it as active
            setActiveWallet(newWallet);
          } else {
            // New wallet not in Privy, need to reconnect
            console.log("New wallet detected, prompting reconnection...");
            // Disconnect and reconnect to get the new wallet
            privyLogout();
            setTimeout(() => privyLogin(), 100);
          }
        }
      };

      // Add listener
      const ethereum = (
        window as Window & {
          ethereum?: {
            on: (event: string, callback: (accounts: string[]) => void) => void;
            removeListener: (
              event: string,
              callback: (accounts: string[]) => void
            ) => void;
          };
        }
      ).ethereum;
      ethereum?.on("accountsChanged", handleAccountsChanged);

      // Cleanup
      return () => {
        ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, [isMiniApp, address, wallets, setActiveWallet, privyLogin, privyLogout]);

  // Determine connection state based on context
  // For browser mode, if user is authenticated with Privy and we have an address,
  // consider them connected even if wagmi is still syncing
  const isConnected = isMiniApp
    ? wagmiIsConnected
    : authenticated && (wagmiIsConnected || (wallets.length > 0 && activeWallet?.address));

  // In browser mode, prefer wagmi's address (which should be synced with Privy)
  // Only fall back to Privy's wallet if wagmi doesn't have an address
  const effectiveAddress =
    address || (!isMiniApp ? activeWallet?.address : undefined);

  // Connect function that handles both contexts
  const connect = useCallback(() => {
    if (isMiniApp) {
      // In mini-app, use wagmi connect with Farcaster connector
      const farcasterConnector = connectors.find(
        (c) => c.id === "farcasterMiniApp"
      );
      if (farcasterConnector) {
        wagmiConnect({ connector: farcasterConnector });
      } else {
        console.error("Farcaster connector not found");
      }
    } else {
      // In browser, only login if not already authenticated
      if (!authenticated) {
        privyLogin();
      }
      // If already authenticated, the UI should already show connected state
      // No need to call any additional functions
    }
  }, [isMiniApp, connectors, wagmiConnect, privyLogin, authenticated]);

  // Disconnect function that handles both contexts
  const disconnect = useCallback(() => {
    if (isMiniApp) {
      wagmiDisconnect();
    } else {
      privyLogout();
    }
  }, [isMiniApp, wagmiDisconnect, privyLogout]);

  // Loading state - mini-app context being null means still detecting
  const isLoading = isMiniApp === null;

  // Debug info for troubleshooting
  const debug = {
    isMiniApp,
    wagmiIsConnected,
    wagmiAddress: address,
    authenticated,
    privyWallets: wallets.map((w) => w.address),
    activePrivyWallet: activeWallet?.address,
    effectiveAddress,
    connector: connector?.id,
  };

  return {
    // Core properties
    address: effectiveAddress,
    isConnected,

    // Actions
    connect,
    disconnect,

    // Context info
    isMiniApp: Boolean(isMiniApp),
    isLoading,

    // Debug info (remove in production)
    debug: process.env.NODE_ENV === "development" ? debug : undefined,
  };
}
