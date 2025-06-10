"use client";

import { TokenGrid } from "../components/TokenGrid";
import { useState, useEffect, useCallback, useRef } from "react";
import { Hero } from "../components/Hero";
import { HeroAnimationMini } from "../components/HeroAnimationMini";
import { TopStreamer } from "../components/TopStreamer";
import { Token, TokensResponse } from "./types/token";
import { SortOption } from "../components/TokenGrid";
import { SearchBar } from "../components/SearchBar";
import { SortButtons } from "../components/SortButtons";
import { Logo } from "../components/Logo";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { Button } from "../components/ui/button";
import { base } from "wagmi/chains";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const hasInitiallyFetched = useRef(false);

  // Debug mechanism for auth test page
  const [debugClickCount, setDebugClickCount] = useState(0);
  const debugClickTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const router = useRouter();

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
    // disconnect,
    promptToAddMiniApp,
    hasPromptedToAdd,
  } = useAppFrameLogic();

  const postHog = usePostHog();

  // PostHog user identification when wallet connects
  useEffect(() => {
    if (isConnected && address && postHog) {
      // Identify the user with their wallet address
      postHog.identify(address, {
        wallet_address: address,
        is_mini_app: isMiniAppView,
        wallet_type: isMiniAppView ? "farcaster" : "wagmi",
        network_connected: isOnCorrectNetwork,
        sdk_loaded: isSDKLoaded,
        // Add Farcaster context if available
        ...(farcasterContext && {
          farcaster_user_fid: farcasterContext.user?.fid,
          farcaster_client_name: farcasterContext.client?.clientFid,
        }),
      });
    } else if (!isConnected && postHog) {
      // Reset identification when wallet disconnects
      postHog.reset();
    }
  }, [
    isConnected,
    address,
    isMiniAppView,
    isOnCorrectNetwork,
    isSDKLoaded,
    farcasterContext,
    postHog,
  ]);

  // Debug click handler for logo
  const handleDebugClick = useCallback(() => {
    setDebugClickCount((prev) => {
      const newCount = prev + 1;

      // Clear any existing timeout
      if (debugClickTimeout.current) {
        clearTimeout(debugClickTimeout.current);
      }

      // Navigate to auth test after 5 clicks
      if (newCount >= 5) {
        console.log("Debug mode activated! Navigating to auth test...");
        router.push("/auth-test");
        return 0; // Reset counter
      }

      // Reset counter after 2 seconds of no clicks
      debugClickTimeout.current = setTimeout(() => {
        setDebugClickCount(0);
      }, 2000);

      return newCount;
    });
  }, [router]);

  // Cleanup effect for debug timeout
  useEffect(() => {
    return () => {
      if (debugClickTimeout.current) {
        clearTimeout(debugClickTimeout.current);
      }
    };
  }, []);

  // Fixed iterative pagination instead of recursive
  const fetchTokens = useCallback(async () => {
    try {
      let allTokens: Token[] = [];
      let nextPage: number | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams();
        if (nextPage) params.append("before", nextPage.toString());

        const response = await fetch(
          `/api/tokens${params.toString() ? `?${params}` : ""}`
        );
        const data: TokensResponse = await response.json();

        allTokens = [...allTokens, ...data.data];
        hasMore = data.hasMore;
        nextPage = data.nextPage;
      }

      setTokens(allTokens);
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if we haven't fetched yet and conditions are met
    if (
      (!isMiniAppView || (isMiniAppView && isOnCorrectNetwork)) &&
      !hasInitiallyFetched.current
    ) {
      hasInitiallyFetched.current = true;
      fetchTokens();
    }
  }, [fetchTokens, isMiniAppView, isOnCorrectNetwork]);

  useEffect(() => {
    if (
      isMiniAppView &&
      isSDKLoaded &&
      !hasPromptedToAdd &&
      promptToAddMiniApp
    ) {
      promptToAddMiniApp();
    }
  }, [isMiniAppView, isSDKLoaded, hasPromptedToAdd, promptToAddMiniApp]);

  // Auto-connect to Farcaster wallet if not connected in mini app context
  useEffect(() => {
    if (isMiniAppView && !isConnected && farcasterContext && isSDKLoaded) {
      console.log(
        "Miniapp detected but not connected, attempting to connect..."
      );
      console.log(
        "Available connectors:",
        connectors.map((c) => ({ id: c.id, name: c.name }))
      );

      // Use the farcasterFrame connector (should be at index 0)
      const farcasterConnector =
        connectors.find((c) => c.id === "farcaster") || connectors[0];
      if (farcasterConnector) {
        console.log("Connecting with connector:", farcasterConnector.id);
        connect({ connector: farcasterConnector });
      }
    }
  }, [
    isMiniAppView,
    isConnected,
    farcasterContext,
    connectors,
    connect,
    isSDKLoaded,
  ]);

  if (!isSDKLoaded) {
    return <div className="text-center py-8">Loading SDK...</div>;
  }

  if (isMiniAppView) {
    return (
      <div className="font-[family-name:var(--font-geist-sans)]">
        <div className="flex flex-col gap-2 row-start-2 items-center w-full p-4 pt-20">
          <div className="fixed top-0 left-0 right-0 flex justify-between items-center p-4 z-10 bg-base-100/80 backdrop-blur-sm">
            <Logo
              onClick={handleDebugClick}
              debugClickCount={debugClickCount}
            />
            <div className="flex-1 mx-4 max-w-md">
              <SearchBar
                value={searchQuery}
                onChange={(value) => setSearchQuery(value)}
              />
            </div>
          </div>

          <div className="w-full max-w-md">
            <div className="flex items-center gap-4 my-2">
              <div className="flex-none w-full">
                <SortButtons
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  isMiniView={true}
                />
              </div>
            </div>
          </div>

          <TokenGrid
            tokens={tokens}
            searchQuery={searchQuery}
            sortBy={sortBy}
          />

          {!isOnCorrectNetwork && isConnected ? (
            <Button
              onClick={() => switchChain && switchChain({ chainId: base.id })}
              disabled={isSwitchingChain || !switchChain}
            >
              {isSwitchingChain
                ? "Switching to Base..."
                : "Switch to Base Network"}
            </Button>
          ) : null}
        </div>
        <div className="fixed inset-0 -z-10">
          <HeroAnimationMini />
        </div>
      </div>
    );
  }

  // Standard Web UI
  return (
    <>
      <div className="font-[family-name:var(--font-geist-sans)]">
        <div className="flex flex-col row-start-2 items-center w-full">
          <Hero />
          <TopStreamer />
          <div className="w-full max-w-[1200px] px-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 my-4">
              <div className="flex-none">
                <SortButtons
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  isMiniView={false}
                />
              </div>
              <div className="flex-1">
                <SearchBar
                  value={searchQuery}
                  onChange={(value) => setSearchQuery(value)}
                />
              </div>
            </div>
            {loading && tokens.length === 0 ? (
              <div className="text-center py-8">Loading tokens...</div>
            ) : (
              <TokenGrid
                tokens={tokens}
                searchQuery={searchQuery}
                sortBy={sortBy}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
