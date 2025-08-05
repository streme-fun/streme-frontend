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
  
  // Don't call Privy hooks at all in mini-app mode to avoid provider warnings
  if (isMiniApp) {
    return {
      authenticated: false,
      login: () => {},
      logout: () => {},
      user: null,
      ready: true,
    };
  }

  // Only call Privy hooks in browser mode when PrivyProvider is available
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
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
  
  // Don't call Privy hooks at all in mini-app mode to avoid provider warnings
  if (isMiniApp) {
    return { wallets: [] };
  }

  // Only call Privy hooks in browser mode when PrivyProvider is available
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useWallets();
  } catch {
    return { wallets: [] };
  }
}

export function useSafeSetActiveWallet() {
  const { isMiniApp } = useEnvironment();
  
  // Don't call Privy hooks at all in mini-app mode to avoid provider warnings
  if (isMiniApp) {
    return { setActiveWallet: () => {} };
  }

  // Only call Privy hooks in browser mode when PrivyProvider is available
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSetActiveWallet();
  } catch {
    return { setActiveWallet: () => {} };
  }
}
