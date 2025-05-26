"use client";

import { useEffect, useRef } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { useWallets } from "@privy-io/react-auth";

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
