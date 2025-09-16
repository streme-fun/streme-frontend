"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useMemo } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useEnvironment } from "../components/providers/EnvironmentProvider";

type WalletLikeUser = {
  wallet?: {
    address?: string | null;
  } | null;
} | null;

/**
 * Wallet-auth helper hooks that mirror the old Privy shape but run entirely on wagmi/RainbowKit.
 * They no-op gracefully inside the Farcaster mini-app environment.
 */

export function useSafeWalletAuth() {
  const { isMiniApp } = useEnvironment();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const login = useCallback(() => {
    if (isMiniApp) return;
    openConnectModal?.();
  }, [isMiniApp, openConnectModal]);

  const logout = useCallback(() => {
    if (isMiniApp) return;
    disconnect();
  }, [isMiniApp, disconnect]);

  const user = useMemo<WalletLikeUser>(() => {
    if (isMiniApp || !address) {
      return null;
    }
    return { wallet: { address } };
  }, [isMiniApp, address]);

  return {
    authenticated: !isMiniApp && isConnected,
    login,
    logout,
    user,
    ready: true,
  };
}

export function useSafeWallets() {
  const { isMiniApp } = useEnvironment();
  const { address, connector } = useAccount();

  if (isMiniApp || !address || !connector) {
    return { wallets: [] as SafeWallet[] };
  }

  const wallet: SafeWallet = {
    address,
    getEthereumProvider: async () => {
      if (!connector.getProvider) {
        throw new Error("Connector does not expose a provider");
      }
      const provider = await connector.getProvider();
      if (!provider) {
        throw new Error("No EIP-1193 provider available for the active connector");
      }
      return provider as EIP1193Provider;
    },
  };

  return { wallets: [wallet] };
}

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

interface SafeWallet {
  address: string;
  getEthereumProvider: () => Promise<EIP1193Provider>;
}

