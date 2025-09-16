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
 * Safe wallet hooks that mimic the previous Privy helpers but run entirely on wagmi/RainbowKit.
 * The helpers gracefully no-op in Farcaster mini-app environments where RainbowKit isn't used.
 */

export function useSafePrivy() {
  const { isMiniApp } = useEnvironment();

  if (isMiniApp) {
    return {
      authenticated: false,
      login: () => {},
      logout: () => {},
      user: null as WalletLikeUser,
      ready: true,
    };
  }

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const login = useCallback(() => {
    openConnectModal?.();
  }, [openConnectModal]);

  const logout = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const user = useMemo<WalletLikeUser>(() => {
    if (!address) {
      return null;
    }
    return { wallet: { address } };
  }, [address]);

  return {
    authenticated: isConnected,
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
