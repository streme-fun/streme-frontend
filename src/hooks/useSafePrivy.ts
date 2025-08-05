"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useEnvironment } from "../components/providers/EnvironmentProvider";

/**
 * Safe Privy hooks that handle mini-app mode gracefully
 * These can be used anywhere instead of calling Privy hooks directly
 */

export function useSafePrivy() {
  const { isMiniApp } = useEnvironment();

  // Don't call Privy hooks at all in mini-app mode
  if (isMiniApp) {
    return {
      authenticated: false,
      login: () => {},
      logout: () => {},
      user: null,
      ready: true,
    };
  }

  try {
    return usePrivy();
  } catch {
    return {
      authenticated: false,
      login: () => {},
      logout: () => {},
      user: null,
      ready: true,
    };
  }
}

export function useSafeWallets() {
  const { isMiniApp } = useEnvironment();

  // Don't call Privy hooks at all in mini-app mode
  if (isMiniApp) {
    return { wallets: [] };
  }

  try {
    return useWallets();
  } catch {
    return { wallets: [] };
  }
}

export function useSafeSetActiveWallet() {
  const { isMiniApp } = useEnvironment();

  // Don't call Privy hooks at all in mini-app mode
  if (isMiniApp) {
    return { setActiveWallet: () => {} };
  }

  try {
    return useSetActiveWallet();
  } catch {
    return { setActiveWallet: () => {} };
  }
}
