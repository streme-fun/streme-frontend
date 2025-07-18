import { createConfig, http, fallback, WagmiProvider as WagmiProviderBase } from "wagmi";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import {
  base,
  baseSepolia,
  degen,
  mainnet,
  optimism,
  unichain,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
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

// RPC endpoints for Base (same as viemClient.ts)
const baseRpcEndpoints = [
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6",
  "https://mainnet.base.org",
  "https://developer-access-mainnet.base.org",
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!,
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
].filter(Boolean); // Remove any undefined/null values

export const config = createConfig({
  chains: [base, baseSepolia, optimism, mainnet, degen, unichain],
  transports: {
    [base.id]: fallback(
      baseRpcEndpoints.map((url) =>
        http(url, {
          timeout: 10_000,
          retryCount: 2,
          retryDelay: 1000,
          batch: true,
        })
      ),
      { rank: false }
    ),
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
    farcasterMiniApp(),
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

// Conditional WagmiProvider that detects mini-app environment
function ConditionalWagmiProvider({ children }: { children: React.ReactNode }) {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isDetected, setIsDetected] = useState(false);

  useEffect(() => {
    const detectMiniApp = async () => {
      try {
        // Quick detection for mini-app
        const quickDetection = 
          typeof window !== "undefined" &&
          !window.location.hostname.includes("localhost") &&
          !window.location.hostname.includes("127.0.0.1") &&
          (window.parent !== window || window.location !== window.parent.location);

        if (quickDetection) {
          // Try to detect with Farcaster SDK
          const sdk = await import("@farcaster/miniapp-sdk");
          const isInMiniApp = await sdk.default.isInMiniApp();
          setIsMiniApp(isInMiniApp);
        } else {
          setIsMiniApp(false);
        }
      } catch (error) {
        console.error("Error detecting mini-app:", error);
        setIsMiniApp(false);
      } finally {
        setIsDetected(true);
      }
    };

    detectMiniApp();
  }, []);

  // Show loading until detection is complete
  if (!isDetected) {
    return <div>Loading...</div>;
  }

  // Use regular wagmi provider for mini-app, Privy provider for others
  const WagmiProvider = isMiniApp ? WagmiProviderBase : PrivyWagmiProvider;

  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConditionalWagmiProvider>
        <CoinbaseWalletAutoConnect>{children}</CoinbaseWalletAutoConnect>
      </ConditionalWagmiProvider>
    </QueryClientProvider>
  );
}
