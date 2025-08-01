"use client";

import { WagmiProvider as WagmiProviderBase, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import React from "react";
import { MiniAppContext } from "../../contexts/MiniAppContext";
import { baseTransport } from "../../lib/wagmiConfig";

// Config for mini-app with only Farcaster connector
export const miniAppConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: baseTransport,
  },
  connectors: [miniAppConnector()],
});

const queryClient = new QueryClient();

// Mini-app specific Wagmi provider
export default function MiniAppWagmiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProviderBase config={miniAppConfig}>
        <MiniAppContext.Provider value={true}>
          {children}
        </MiniAppContext.Provider>
      </WagmiProviderBase>
    </QueryClientProvider>
  );
}
