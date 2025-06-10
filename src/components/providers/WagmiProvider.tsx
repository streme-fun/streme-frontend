import { createConfig, http, WagmiProvider } from "wagmi";
import {
  base,
  baseSepolia,
  degen,
  mainnet,
  optimism,
  unichain,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { coinbaseWallet, metaMask } from "wagmi/connectors";
import { APP_NAME, APP_ICON_URL, APP_URL } from "../../lib/constants";
import { useEffect, useState } from "react";
import { useConnect, useAccount } from "wagmi";
import React from "react";

// Helper function to safely check wallet provider
const safeProviderCheck = (providerName: string) => {
  try {
    if (typeof window === "undefined" || !window.ethereum) return false;

    // Handle cases where multiple wallets are installed
    const ethereum = window.ethereum;

    switch (providerName) {
      case "coinbase":
        return !!(
          ethereum.isCoinbaseWallet ||
          ethereum.isCoinbaseWalletExtension ||
          ethereum.isCoinbaseWalletBrowser
        );
      case "metamask":
        return !!(ethereum.isMetaMask && !ethereum.isCoinbaseWallet);
      default:
        return false;
    }
  } catch (error) {
    console.warn(`Error checking ${providerName} provider:`, error);
    return false;
  }
};

// Custom hook for Coinbase Wallet detection and auto-connection
function useCoinbaseWalletAutoConnect() {
  const [isCoinbaseWallet, setIsCoinbaseWallet] = useState(false);
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    // Check if we're running in Coinbase Wallet
    const checkCoinbaseWallet = () => {
      const isInCoinbaseWallet = safeProviderCheck("coinbase");
      setIsCoinbaseWallet(isInCoinbaseWallet);
    };

    checkCoinbaseWallet();

    // Listen for ethereum provider initialization with error handling
    const handleEthereumInit = () => {
      try {
        checkCoinbaseWallet();
      } catch (error) {
        console.warn("Error during ethereum provider initialization:", error);
      }
    };

    window.addEventListener("ethereum#initialized", handleEthereumInit);

    return () => {
      window.removeEventListener("ethereum#initialized", handleEthereumInit);
    };
  }, []);

  useEffect(() => {
    // Auto-connect if in Coinbase Wallet and not already connected
    if (isCoinbaseWallet && !isConnected && connectors.length > 1) {
      try {
        const coinbaseConnector = connectors.find(
          (connector) => connector.id === "coinbaseWallet"
        );
        if (coinbaseConnector) {
          connect({ connector: coinbaseConnector });
        }
      } catch (error) {
        console.warn("Error auto-connecting Coinbase Wallet:", error);
      }
    }
  }, [isCoinbaseWallet, isConnected, connect, connectors]);

  return isCoinbaseWallet;
}

export const config = createConfig({
  chains: [base, baseSepolia, optimism, mainnet, degen, unichain],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [optimism.id]: http(),
    [mainnet.id]: http(),
    [degen.id]: http(),
    [unichain.id]: http(),
  },
  connectors: [
    metaMask({
      dappMetadata: {
        name: APP_NAME,
        url: APP_URL,
      },
    }),
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_ICON_URL,
      preference: "all",
    }),
    farcasterFrame(),
  ],
});

const queryClient = new QueryClient();

// Wrapper component that provides Coinbase Wallet auto-connection
function CoinbaseWalletAutoConnect({
  children,
}: {
  children: React.ReactNode;
}) {
  useCoinbaseWalletAutoConnect();
  return <>{children}</>;
}

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <CoinbaseWalletAutoConnect>{children}</CoinbaseWalletAutoConnect>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
