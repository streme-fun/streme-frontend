"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { useSafeWalletAuth, useSafeWallets } from "./useSafeWallet";

/**
 * Hook that listens for wallet account changes from browser extensions
 * and automatically syncs wagmi's active account
 */
export function useWalletSync() {
  const { address: currentWagmiAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { wallets } = useSafeWallets();
  const lastKnownAddress = useRef<string | null>(null);

  useEffect(() => {
    // Store the current wagmi address
    if (currentWagmiAddress) {
      lastKnownAddress.current = currentWagmiAddress.toLowerCase();
    }
  }, [currentWagmiAddress]);

  useEffect(() => {
    const setupWalletListeners = async () => {
      // Listen to the global window.ethereum for account changes
      if (
        typeof window !== "undefined" &&
        window.ethereum &&
        wallets.length > 0
      ) {
        const handleAccountsChanged = async (accounts: string[]) => {
          if (accounts.length > 0) {
            const newAddress = accounts[0].toLowerCase();
            const currentAddress = lastKnownAddress.current;

            console.log(
              "Browser extension account changed from",
              currentAddress,
              "to",
              newAddress
            );

            // Only act if the address actually changed
            if (newAddress !== currentAddress) {
              console.log("Syncing wagmi with new account:", newAddress);

              try {
                // Disconnect current wagmi connection
                disconnect();

                // Small delay to ensure disconnection is processed
                setTimeout(() => {
                  // Find the appropriate connector (MetaMask, Coinbase, etc.)
                  const injectedConnector = connectors.find(
                    (connector) =>
                      connector.type === "injected" ||
                      connector.id === "metaMask" ||
                      connector.id === "coinbaseWallet"
                  );

                  if (injectedConnector) {
                    // Reconnect with the new account
                    connect({ connector: injectedConnector });
                    lastKnownAddress.current = newAddress;
                    console.log(
                      "Successfully synced wagmi with new account:",
                      newAddress
                    );
                  } else {
                    console.error(
                      "No suitable connector found for reconnection"
                    );
                  }
                }, 100);
              } catch (error) {
                console.error("Failed to sync wagmi with new account:", error);
              }
            }
          }
        };

        // Add event listener to the global ethereum object
        window.ethereum.on("accountsChanged", handleAccountsChanged);

        // Cleanup function
        return () => {
          window.ethereum?.removeListener(
            "accountsChanged",
            handleAccountsChanged
          );
        };
      }
    };

    setupWalletListeners();
  }, [wallets, disconnect, connect, connectors]);
}

/**
 * Hook that listens for wallet address changes and provides a refresh trigger
 * for components that need to update when the wallet address changes
 */
export function useWalletAddressChange() {
  const { user, ready } = useSafeWalletAuth();
  const { wallets } = useSafeWallets();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const lastKnownAddress = useRef<string | null>(null);
  const lastKnownWalletsHash = useRef<string>("");
  const lastKnownBrowserAccount = useRef<string | null>(null);

  // Rate limiting for wallet requests
  const lastWalletRequestTime = useRef<number>(0);
  const walletRequestCache = useRef<string | null>(null);
  const walletRequestCacheTime = useRef<number>(0);
  const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between wallet requests
  const CACHE_DURATION = 5000; // Cache wallet address for 5 seconds

  // Get the effective wallet address (similar to component logic)
  const getEffectiveAddress = useCallback(() => {
    if (!user?.wallet?.address || !wallets || wallets.length === 0) return null;

    let wallet = wallets.find((w) => w.address === user.wallet?.address);
    if (!wallet) {
      wallet = wallets.find(
        (w) => w.address?.toLowerCase() === user.wallet?.address?.toLowerCase()
      );
    }
    if (!wallet && wallets.length === 1) {
      wallet = wallets[0];
    }

    return wallet?.address || null;
  }, [user?.wallet?.address, wallets]);

  // Get the primary wallet address (first wallet in the array)
  const getPrimaryWalletAddress = useCallback(() => {
    if (!wallets || wallets.length === 0) return null;
    return wallets[0]?.address || null;
  }, [wallets]);

  // Get the current browser wallet address with rate limiting and caching
  const getBrowserWalletAddress = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      const now = Date.now();

      // Return cached result if still valid
      if (
        walletRequestCache.current &&
        now - walletRequestCacheTime.current < CACHE_DURATION
      ) {
        return walletRequestCache.current;
      }

      // Rate limit requests
      if (now - lastWalletRequestTime.current < MIN_REQUEST_INTERVAL) {
        return walletRequestCache.current;
      }

      try {
        lastWalletRequestTime.current = now;
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        const address = accounts[0] || null;

        // Cache the result
        walletRequestCache.current = address;
        walletRequestCacheTime.current = now;

        return address;
      } catch (error) {
        console.error("Error getting browser wallet address:", error);
        return walletRequestCache.current; // Return cached value on error
      }
    }
    return null;
  }, []);

  // Trigger refresh when address changes
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Manual refresh function that components can call
  const manualRefresh = useCallback(() => {
    console.log("useWalletAddressChange: Manual refresh triggered");
    // Clear cache on manual refresh
    walletRequestCache.current = null;
    walletRequestCacheTime.current = 0;
    triggerRefresh();
  }, [triggerRefresh]);

  // Initialize browser wallet address on first load
  useEffect(() => {
    const initializeBrowserWallet = async () => {
      if (
        typeof window !== "undefined" &&
        window.ethereum &&
        !lastKnownBrowserAccount.current
      ) {
        const browserAddress = await getBrowserWalletAddress();
        if (browserAddress) {
          lastKnownBrowserAccount.current = browserAddress;
          console.log("Initialized browser wallet address:", browserAddress);
        }
      }
    };

    initializeBrowserWallet();
  }, [getBrowserWalletAddress]);

  // Watch for changes in the effective address
  useEffect(() => {
    const currentAddress = getEffectiveAddress();
    const primaryAddress = getPrimaryWalletAddress();

    // Use primary wallet address if available, fallback to effective address
    const addressToTrack = primaryAddress || currentAddress;

    if (addressToTrack && addressToTrack !== lastKnownAddress.current) {
      console.log("Wallet address changed:", {
        from: lastKnownAddress.current,
        to: addressToTrack,
      });
      lastKnownAddress.current = addressToTrack;
      triggerRefresh();
    }
  }, [
    getEffectiveAddress,
    getPrimaryWalletAddress,
    triggerRefresh,
    user?.wallet?.address,
    wallets,
    ready,
  ]);

  // Watch for changes in the wallets array composition
  useEffect(() => {
    const walletsHash =
      wallets
        ?.map((w) => w.address)
        .sort()
        .join(",") || "";

    if (walletsHash && walletsHash !== lastKnownWalletsHash.current) {
      console.log("Wallets array changed:", {
        from: lastKnownWalletsHash.current,
        to: walletsHash,
      });
      lastKnownWalletsHash.current = walletsHash;
      triggerRefresh();
    }
  }, [wallets, triggerRefresh]);

  // Watch for browser wallet changes and compare with RainbowKit/wagmi state (reduced frequency)
  useEffect(() => {
    const checkBrowserWallet = async () => {
      const browserAddress = await getBrowserWalletAddress();

      // Only process if we actually got an address and it's different from what we know
      if (browserAddress) {
        const normalizedBrowserAddress = browserAddress.toLowerCase();
        const normalizedLastKnown =
          lastKnownBrowserAccount.current?.toLowerCase();

        if (normalizedBrowserAddress !== normalizedLastKnown) {
          console.log("Browser wallet address changed:", {
            from: lastKnownBrowserAccount.current,
            to: browserAddress,
          });
          lastKnownBrowserAccount.current = browserAddress;

          // Check if cached wallet state is out of sync with the browser wallet
          const primaryAddress = getPrimaryWalletAddress();
          if (primaryAddress?.toLowerCase() !== normalizedBrowserAddress) {
            console.log(
              "Wallet state out of sync with browser wallet, forcing refresh"
            );
            triggerRefresh();
          }
        }
      }
    };

    // Only check if we have ethereum provider and wallets
    if (
      typeof window !== "undefined" &&
      window.ethereum &&
      wallets?.length > 0
    ) {
      // Check immediately but don't repeat if there's already a listener
      checkBrowserWallet();

      // Reduced frequency: check every 10 seconds instead of every second
      const interval = setInterval(checkBrowserWallet, 10000);
      return () => clearInterval(interval);
    }
  }, [
    getBrowserWalletAddress,
    getPrimaryWalletAddress,
    triggerRefresh,
    wallets?.length,
  ]);

  // Listen for browser wallet account changes (this is more efficient than polling)
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log("Browser wallet accounts changed:", accounts);
        console.log("Current connected wallet:", user?.wallet?.address);
        console.log(
          "Available wallets:",
          wallets?.map((w) => w.address)
        );

        if (accounts.length > 0) {
          lastKnownBrowserAccount.current = accounts[0];
          // Clear cache when accounts change
          walletRequestCache.current = accounts[0];
          walletRequestCacheTime.current = Date.now();
        }

        // Trigger refresh after a short delay to allow wagmi state to update
        setTimeout(() => {
          console.log("Triggering refresh due to accountsChanged");
          triggerRefresh();
        }, 500); // Increased delay to allow wagmi more time to sync
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);

      return () => {
        window.ethereum?.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
      };
    }
  }, [triggerRefresh, user?.wallet?.address, wallets]);

  return {
    refreshTrigger,
    effectiveAddress: getEffectiveAddress(),
    primaryAddress: getPrimaryWalletAddress(),
    triggerRefresh,
    manualRefresh,
  };
}
