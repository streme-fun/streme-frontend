"use client";

import {
  createConfig,
  WagmiProvider as PrivyWagmiProvider,
} from "@privy-io/wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { MiniAppContext } from "../../contexts/MiniAppContext";
import { baseTransport } from "../../lib/wagmiConfig";

// Config for browser with Privy-managed connectors
export const browserConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: baseTransport,
  },
  // Privy manages connectors internally
});

const queryClient = new QueryClient();

// Browser specific Wagmi provider using Privy
export default function BrowserWagmiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyWagmiProvider config={browserConfig}>
        <MiniAppContext.Provider value={false}>
          {children}
        </MiniAppContext.Provider>
      </PrivyWagmiProvider>
    </QueryClientProvider>
  );
}