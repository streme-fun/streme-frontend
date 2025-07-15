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
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { Button } from "../components/ui/button";
import { base } from "wagmi/chains";
import Image from "next/image";
import { usePostHog } from "posthog-js/react";
// import { MiniAppTutorialModal } from "../components/MiniAppTutorialModal";
import { SPAMMER_BLACKLIST } from "../lib/blacklist";
import Link from "next/link";

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const hasInitiallyFetched = useRef(false);

  // Tutorial modal state
  // const [showTutorialModal, setShowTutorialModal] = useState(false);
  // const [hasSkippedTutorial, setHasSkippedTutorial] = useState(false);
  // const [hasShownTutorialThisSession, setHasShownTutorialThisSession] =
  //   useState(false);

  // Load tutorial skip state from localStorage on mount
  // useEffect(() => {
  //   if (typeof window !== "undefined") {
  //     const skipped = localStorage.getItem("streme-tutorial-skipped");
  //     if (skipped === "true") {
  //       setHasSkippedTutorial(true);
  //     }
  //   }
  // }, []);

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
    // hasAddedMiniApp,
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

      // Filter out blacklisted tokens and tokens with $ in name/symbol before setting state
      const filteredTokens = allTokens.filter((token) => {
        // Check blacklist
        if (token.creator?.name) {
          const creatorName = token.creator.name?.toLowerCase() || "";
          const isBlacklisted = SPAMMER_BLACKLIST.includes(creatorName);
          if (isBlacklisted) return false;
        }

        // Filter out tokens with $ in name or symbol
        if (token.name && token.name.includes("$")) {
          return false;
        }
        if (token.symbol && token.symbol.includes("$")) {
          return false;
        }

        return true;
      });

      setTokens(filteredTokens);
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

  // Show tutorial modal for mini-app users who haven't added the app
  // useEffect(() => {
  //   if (
  //     isMiniAppView &&
  //     isSDKLoaded &&
  //     !hasAddedMiniApp &&
  //     !hasSkippedTutorial &&
  //     !hasShownTutorialThisSession
  //   ) {
  //     // Small delay to ensure everything is loaded
  //     const timer = setTimeout(() => {
  //       setShowTutorialModal(true);
  //       setHasShownTutorialThisSession(true);
  //       // Track tutorial modal shown
  //       postHog?.capture("mini_app_tutorial_shown", {
  //         context: "farcaster_mini_app",
  //       });
  //     }, 1000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [
  //   isMiniAppView,
  //   isSDKLoaded,
  //   hasAddedMiniApp,
  //   hasSkippedTutorial,
  //   hasShownTutorialThisSession,
  //   postHog,
  // ]);

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

  // Tutorial modal handlers
  // const handleCloseTutorial = () => {
  //   setShowTutorialModal(false);
  //   // Save completion state so user doesn't see tutorial again
  //   if (typeof window !== "undefined") {
  //     localStorage.setItem("streme-tutorial-skipped", "true");
  //   }
  //   // Track tutorial completion
  //   postHog?.capture("mini_app_tutorial_completed", {
  //     context: "farcaster_mini_app",
  //   });
  // };

  // const handleSkipTutorial = () => {
  //   setHasSkippedTutorial(true);
  //   setShowTutorialModal(false);
  //   // Save to localStorage so user doesn't see tutorial again
  //   if (typeof window !== "undefined") {
  //     localStorage.setItem("streme-tutorial-skipped", "true");
  //   }
  //   // Track tutorial skip
  //   postHog?.capture("mini_app_tutorial_skipped", {
  //     context: "farcaster_mini_app",
  //   });
  // };

  if (!isSDKLoaded) {
    return <div className="text-center py-8">Loading SDK...</div>;
  }

  if (isMiniAppView) {
    return (
      <div className="font-[family-name:var(--font-geist-sans)]">
        <div className="flex flex-col gap-2 row-start-2 items-center w-full p-4 pt-20">
          <div className="fixed top-0 left-0 right-0 flex items-center p-4 z-10 bg-base-100/80 backdrop-blur-sm">
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/icon-transparent.png"
                alt="Streme Logo"
                width={30}
                height={30}
              />
            </Link>
            <div className="flex-1 ml-6 mr-4 max-w-xs">
              <SearchBar
                value={searchQuery}
                onChange={(value) => setSearchQuery(value)}
              />
            </div>
            {/* <div className="flex-shrink-0">
              <button
                onClick={() => setShowTutorialModal(true)}
                className="bg-base-50 backdrop-blur-sm cursor-pointer"
                title="Tutorial"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div> */}
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
            isMiniApp={true}
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

        {/* Tutorial Modal */}
        {/* <MiniAppTutorialModal
          isOpen={showTutorialModal}
          onClose={handleCloseTutorial}
          onSkip={handleSkipTutorial}
        /> */}
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
                isMiniApp={false}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
