"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import React from "react";
import { WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { MiniAppContext } from "../../contexts/MiniAppContext";
import { baseTransport } from "../../lib/wagmiConfig";

const queryClient = new QueryClient();

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect-based wallets may fail to connect."
  );
}

// Browser specific wagmi config using RainbowKit connectors
export const browserConfig = getDefaultConfig({
  appName: "Streme Fun",
  projectId: walletConnectProjectId,
  chains: [base],
  transports: {
    [base.id]: baseTransport,
  },
  ssr: true,
});

export default function BrowserWagmiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={browserConfig}>
        <RainbowKitProvider>
          <MiniAppContext.Provider value={false}>
            {children}
          </MiniAppContext.Provider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
