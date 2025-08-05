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
  
  // Always call hooks to satisfy React rules
  let privyResult;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    privyResult = usePrivy();
  } catch {
    privyResult = null;
  }

  // Return mock values for mini-app mode
  if (isMiniApp || !privyResult) {
    return {
      authenticated: false,
      login: () => {},
      logout: () => {},
      user: null,
      ready: true,
    };
  }

  return privyResult;
}

export function useSafeWallets() {
  const { isMiniApp } = useEnvironment();
  
  // Always call hooks to satisfy React rules
  let walletsResult;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    walletsResult = useWallets();
  } catch {
    walletsResult = null;
  }

  // Return mock values for mini-app mode
  if (isMiniApp || !walletsResult) {
    return { wallets: [] };
  }

  return walletsResult;
}

export function useSafeSetActiveWallet() {
  const { isMiniApp } = useEnvironment();
  
  // Always call hooks to satisfy React rules
  let setActiveWalletResult;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    setActiveWalletResult = useSetActiveWallet();
  } catch {
    setActiveWalletResult = null;
  }

  // Return mock values for mini-app mode
  if (isMiniApp || !setActiveWalletResult) {
    return { setActiveWallet: () => {} };
  }

  return setActiveWalletResult;
}
