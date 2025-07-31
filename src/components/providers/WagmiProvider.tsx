import {
  createConfig,
  http,
  fallback,
  WagmiProvider as WagmiProviderBase,
} from "wagmi";
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
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, metaMask } from "wagmi/connectors";
import { APP_NAME, APP_ICON_URL, APP_URL } from "../../lib/constants";
import { useEffect, useState, createContext, useContext, useRef } from "react";
import { useDisconnect, useAccount, useConnections } from "wagmi";
import React from "react";
import sdk from "@farcaster/miniapp-sdk";

// Mini-app context for sharing detection result
export const MiniAppContext = createContext<boolean | null>(null);

export function useMiniAppContext() {
  const context = useContext(MiniAppContext);
  if (context === undefined) {
    throw new Error('useMiniAppContext must be used within MiniAppProvider');
  }
  return context;
}

// RPC endpoints for Base (same as viemClient.ts)
const baseRpcEndpoints = [
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6",
  "https://mainnet.base.org",
  "https://developer-access-mainnet.base.org",
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!,
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
].filter(Boolean);

// Single config with all connectors
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
    miniAppConnector(),
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
  ],
});

const queryClient = new QueryClient();

// Inner provider that handles wallet management
function WagmiProviderInner({ children, isMiniApp }: { children: React.ReactNode; isMiniApp: boolean }) {
  const hasDisconnectedRef = useRef(false);
  const walletMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const { disconnect } = useDisconnect();
  const { address, connector } = useAccount();
  const connections = useConnections();

  // Aggressive disconnect logic for mini-app context
  useEffect(() => {
    if (isMiniApp && !hasDisconnectedRef.current) {
      console.log("🔌 Mini-app context detected, implementing wallet isolation...");
      hasDisconnectedRef.current = true;
      
      // Initial disconnect after delay
      const initialTimeoutId = setTimeout(() => {
        const nonFarcasterConnections = connections.filter(
          connection => connection.connector.id !== 'farcasterMiniApp'
        );
        
        if (nonFarcasterConnections.length > 0) {
          console.log(`🔌 Disconnecting ${nonFarcasterConnections.length} browser wallets`);
          nonFarcasterConnections.forEach((connection) => {
            console.log(`🔌 Disconnecting: ${connection.connector.id}`);
            disconnect({ connector: connection.connector });
          });
        }

        // Also check current connector
        if (connector && connector.id !== 'farcasterMiniApp' && address) {
          console.log(`🔌 Disconnecting current browser connector: ${connector.id}`);
          disconnect();
        }
      }, 500);

      // Set up continuous monitoring to prevent browser wallet reconnections
      walletMonitorRef.current = setInterval(() => {
        if (isMiniApp) {
          const activeBrowserConnections = connections.filter(
            connection => connection.connector.id !== 'farcasterMiniApp' && connection.accounts.length > 0
          );
          
          if (activeBrowserConnections.length > 0) {
            console.log(`🔌 Detected ${activeBrowserConnections.length} browser wallet reconnections, disconnecting...`);
            activeBrowserConnections.forEach((connection) => {
              console.log(`🔌 Auto-disconnecting: ${connection.connector.id}`);
              disconnect({ connector: connection.connector });
            });
          }
        }
      }, 2000); // Check every 2 seconds
      
      return () => {
        clearTimeout(initialTimeoutId);
        if (walletMonitorRef.current) {
          clearInterval(walletMonitorRef.current);
        }
      };
    }
    
    // Clean up monitor when switching back to browser mode
    if (!isMiniApp && walletMonitorRef.current) {
      clearInterval(walletMonitorRef.current);
      walletMonitorRef.current = null;
    }
  }, [isMiniApp, connections, disconnect, connector, address]);

  // Log connection state changes for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("🔄 Wallet connection state:", {
        context: isMiniApp ? "Mini-App" : "Browser",
        address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "none",
        connector: connector?.id || "none",
        connectionsCount: connections.length,
        connectionTypes: connections.map(c => c.connector.id),
        activeConnections: connections.filter(c => c.accounts.length > 0).map(c => c.connector.id),
      });
    }
  }, [isMiniApp, address, connector, connections]);

  // Add global event listeners to prevent browser wallet auto-connections in mini-app
  useEffect(() => {
    if (isMiniApp) {
      const preventBrowserWalletConnection = (event: Event) => {
        // Try to prevent browser wallet injection events
        if (event.type === 'ethereum#initialized' || event.type === 'eip6963:announceProvider') {
          console.log("🔌 Preventing browser wallet initialization in mini-app context");
          event.preventDefault();
          event.stopPropagation();
        }
      };

      // Listen for common browser wallet events
      window.addEventListener('ethereum#initialized', preventBrowserWalletConnection);
      window.addEventListener('eip6963:announceProvider', preventBrowserWalletConnection);

      return () => {
        window.removeEventListener('ethereum#initialized', preventBrowserWalletConnection);
        window.removeEventListener('eip6963:announceProvider', preventBrowserWalletConnection);
      };
    }
  }, [isMiniApp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (walletMonitorRef.current) {
        clearInterval(walletMonitorRef.current);
      }
    };
  }, []);

  // Provide mini-app context to children
  return (
    <MiniAppContext.Provider value={isMiniApp}>
      {children}
    </MiniAppContext.Provider>
  );
}

// Main provider component
export default function WagmiProvider({ children }: { children: React.ReactNode }) {
  const [isMiniApp, setIsMiniApp] = useState<boolean | null>(null);

  // Quick check to determine provider type
  useEffect(() => {
    sdk.isInMiniApp()
      .then((result) => {
        console.log("🔍 Outer provider mini-app detection:", result);
        setIsMiniApp(result);
      })
      .catch(() => {
        console.log("🔍 Outer provider mini-app detection failed, assuming browser");
        setIsMiniApp(false);
      });
  }, []);

  // Show loading until we know the context
  if (isMiniApp === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Use appropriate provider based on context
  const Provider = isMiniApp ? WagmiProviderBase : PrivyWagmiProvider;

  return (
    <QueryClientProvider client={queryClient}>
      <Provider config={config}>
        <WagmiProviderInner isMiniApp={isMiniApp}>{children}</WagmiProviderInner>
      </Provider>
    </QueryClientProvider>
  );
}