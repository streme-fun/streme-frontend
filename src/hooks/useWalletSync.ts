"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { useWallets, usePrivy } from "@privy-io/react-auth";

/**
 * Hook that listens for wallet account changes from browser extensions
 * and automatically syncs wagmi's active account
 */
export function useWalletSync() {
  const { address: currentWagmiAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { wallets } = useWallets();
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
  const { user, ready } = usePrivy();
  const { wallets } = useWallets();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const lastKnownAddress = useRef<string | null>(null);
  const lastKnownWalletsHash = useRef<string>("");
  const lastKnownBrowserAccount = useRef<string | null>(null);

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

  // Get the current browser wallet address
  const getBrowserWalletAddress = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        return accounts[0] || null;
      } catch (error) {
        console.error("Error getting browser wallet address:", error);
        return null;
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
    triggerRefresh();
  }, [triggerRefresh]);

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

  // Watch for browser wallet changes and compare with Privy state
  useEffect(() => {
    const checkBrowserWallet = async () => {
      const browserAddress = await getBrowserWalletAddress();
      if (
        browserAddress &&
        browserAddress !== lastKnownBrowserAccount.current
      ) {
        console.log("Browser wallet address changed:", {
          from: lastKnownBrowserAccount.current,
          to: browserAddress,
        });
        lastKnownBrowserAccount.current = browserAddress;

        // Check if Privy is out of sync with browser wallet
        const primaryAddress = getPrimaryWalletAddress();
        if (primaryAddress?.toLowerCase() !== browserAddress.toLowerCase()) {
          console.log("Privy out of sync with browser wallet, forcing refresh");
          triggerRefresh();
        }
      }
    };

    // Check immediately and then periodically
    checkBrowserWallet();
    const interval = setInterval(checkBrowserWallet, 1000);
    return () => clearInterval(interval);
  }, [getBrowserWalletAddress, getPrimaryWalletAddress, triggerRefresh]);

  // Listen for browser wallet account changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log("Browser wallet accounts changed:", accounts);
        console.log("Current Privy user wallet:", user?.wallet?.address);
        console.log(
          "Available wallets:",
          wallets?.map((w) => w.address)
        );

        if (accounts.length > 0) {
          lastKnownBrowserAccount.current = accounts[0];
        }

        // Trigger refresh after a short delay to allow Privy to update
        setTimeout(() => {
          console.log("Triggering refresh due to accountsChanged");
          triggerRefresh();
        }, 500); // Increased delay to allow Privy more time to sync
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
