"use client";

import { TokenGrid } from "../components/TokenGrid";
// import { ViewSwitcher } from "./components/ViewSwitcher";
import { useState, useEffect } from "react";
import { Hero } from "../components/Hero";
import { TopStreamer } from "../components/TopStreamer";
import { Token, TokensResponse } from "./types/token";
// import { sdk } from "@farcaster/frame-sdk"; // No longer directly needed here for init
import { useAppFrameLogic } from "../hooks/useAppFrameLogic"; // Import the new hook
import { Button } from "../components/ui/button"; // Corrected import path based on file structure
import { base } from "wagmi/chains"; // Only base needed here now

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    isSDKLoaded,
    isMiniAppView,
    farcasterContext,
    address,
    isConnected,
    isOnCorrectNetwork,
    connect,
    connectors,
    switchChain,
    isSwitchingChain,
    disconnect,
  } = useAppFrameLogic(); // Use the hook

  const fetchTokens = async (before?: number) => {
    try {
      const params = new URLSearchParams();
      if (before) params.append("before", before.toString());

      const response = await fetch(
        `/api/tokens${params.toString() ? `?${params}` : ""}`
      );
      const data: TokensResponse = await response.json();

      if (before) {
        setTokens((prev) => [...prev, ...data.data]);
      } else {
        setTokens(data.data);
      }

      if (data.hasMore && data.nextPage) {
        await fetchTokens(data.nextPage);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isMiniAppView || (isMiniAppView && isOnCorrectNetwork)) {
      fetchTokens();
    }
  }, [isMiniAppView, isOnCorrectNetwork]);

  if (!isSDKLoaded) {
    return <div className="text-center py-8">Loading SDK...</div>;
  }

  if (isMiniAppView) {
    const handleMiniAppConnect = () => {
      const fcConnector = connectors.find((c) => c.id === "farcaster");
      if (fcConnector) {
        connect({ connector: fcConnector });
      } else {
        console.warn(
          "Farcaster connector not found. Ensure it's configured in WagmiProvider.tsx and active in the Farcaster client."
        );
        // Optional: Fallback to the first connector if Farcaster one isn't found,
        // though this might lead to unexpected behavior if not the Frame connector.
        if (connectors.length > 0) {
          // connect({ connector: connectors[0] });
        }
      }
    };

    return (
      <div className="font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full p-4">
          <h1 className="text-xl font-bold">Farcaster Mini-App</h1>

          {!isConnected ? (
            <Button onClick={handleMiniAppConnect}>Connect Wallet</Button>
          ) : !isOnCorrectNetwork ? (
            <Button
              onClick={() => switchChain && switchChain({ chainId: base.id })}
              disabled={isSwitchingChain || !switchChain}
            >
              {isSwitchingChain
                ? "Switching to Base..."
                : "Switch to Base Network"}
            </Button>
          ) : (
            <>
              <p className="text-sm">Connected: {address}</p>
              <p className="text-sm">
                FID: {farcasterContext?.user?.fid?.toString()}
              </p>
              {/* <TopStreamer /> */}
              {/* <div className="w-full max-w-[1200px]">
                {loading && tokens.length === 0 ? (
                  <div className="text-center py-8">
                    Loading tokens for Mini-App...
                  </div>
                ) : (
                  <TokenGrid tokens={tokens} />
                )}
              </div> */}
              <Button onClick={() => disconnect()}>Disconnect Wallet</Button>
            </>
          )}
        </main>
      </div>
    );
  }

  // Standard Web UI
  return (
    <>
      <div className="font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full">
          <Hero />
          <TopStreamer />
          <div className="w-full max-w-[1200px]">
            {loading && tokens.length === 0 ? (
              <div className="text-center py-8">Loading tokens...</div>
            ) : (
              <TokenGrid tokens={tokens} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
