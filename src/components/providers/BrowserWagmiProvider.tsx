"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  getDefaultConfig,
  type Wallet,
} from "@rainbow-me/rainbowkit";
import {
  baseAccount,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import React from "react";
import { WagmiProvider, createConnector } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
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

const coinbaseInjectedWallet = (): Wallet => ({
  id: "coinbaseInjected",
  name: "Coinbase Wallet",
  shortName: "Coinbase",
  rdns: "com.coinbase.wallet",
  iconUrl:
    "data:image/svg+xml,%3Csvg%20width%3D%2228%22%20height%3D%2228%22%20viewBox%3D%220%200%2028%2028%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22%232C5FF6%22%2F%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M14%2023.8C19.4124%2023.8%2023.8%2019.4124%2023.8%2014C23.8%208.58761%2019.4124%204.2%2014%204.2C8.58761%204.2%204.2%208.58761%204.2%2014C4.2%2019.4124%208.58761%2023.8%2014%2023.8ZM11.55%2010.8C11.1358%2010.8%2010.8%2011.1358%2010.8%2011.55V16.45C10.8%2016.8642%2011.1358%2017.2%2011.55%2017.2H16.45C16.8642%2017.2%2017.2%2016.8642%2017.2%2016.45V11.55C17.2%2011.1358%2016.8642%2010.8%2016.45%2010.8H11.55Z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E",
  iconAccent: "#2c5ff6",
  iconBackground: "#2c5ff6",
  createConnector: (walletDetails) =>
    createConnector((config) => ({
      ...injected({ target: "coinbaseWallet" })(config),
      ...walletDetails,
    })),
});

// Browser specific wagmi config using RainbowKit connectors
export const browserConfig = getDefaultConfig({
  appName: "Streme Fun",
  projectId: walletConnectProjectId,
  chains: [base],
  wallets: [
    {
      groupName: "Popular",
      wallets: [
        safeWallet,
        coinbaseInjectedWallet,
        injectedWallet,
        rainbowWallet,
        baseAccount,
        metaMaskWallet,
        walletConnectWallet,
      ],
    },
  ],
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
