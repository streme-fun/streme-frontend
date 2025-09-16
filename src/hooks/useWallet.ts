"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useMemo } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useMiniAppContext } from "../contexts/MiniAppContext";

/**
 * Simplified wallet hook that provides a clean interface for wallet connections
 * across both browser and mini-app contexts.
 *
 * In mini-app: Uses wagmi directly with the Farcaster connector
 * In browser: Uses RainbowKit to drive wallet selection
 */
export function useWallet() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const isMiniApp = useMiniAppContext();

  const handleConnect = useCallback(() => {
    if (isMiniApp) {
      const farcasterConnector = connectors.find(
        (c) => c.id === "farcasterMiniApp"
      );
      if (farcasterConnector) {
        connect({ connector: farcasterConnector });
      } else {
        console.error("Farcaster connector not found");
      }
      return;
    }

    openConnectModal?.();
  }, [isMiniApp, connectors, connect, openConnectModal]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const debug = useMemo(
    () => ({
      isMiniApp,
      wagmiIsConnected: isConnected,
      wagmiAddress: address,
      connector: connector?.id,
    }),
    [isMiniApp, isConnected, address, connector?.id]
  );

  return {
    address: address || undefined,
    isConnected,
    connect: handleConnect,
    disconnect: handleDisconnect,
    isMiniApp: Boolean(isMiniApp),
    isLoading: isMiniApp === null,
    debug: process.env.NODE_ENV === "development" ? debug : undefined,
  };
}
