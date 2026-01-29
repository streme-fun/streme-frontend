"use client";

import {
  TokenGrid,
  TrendingTokensCarousel,
  fetchTrendingTokens,
} from "../components/TokenGrid";
import { useState, useEffect, useCallback, useRef } from "react";
import { Hero } from "../components/Hero";
import { Token, TokensResponse } from "./types/token";
import { SortOption } from "../components/TokenGrid";
import { SearchBar } from "../components/SearchBar";
import { SortButtons } from "../components/SortButtons";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";
import { Button } from "../components/ui/button";
import { base } from "wagmi/chains";
import { usePostHog } from "posthog-js/react";
// import { MiniAppTutorialModal } from "../components/MiniAppTutorialModal"; // DISABLED
import { SPAMMER_BLACKLIST } from "../lib/blacklist";
import Link from "next/link";
import { CheckinModal } from "../components/CheckinModal";
import { CheckinSuccessModal } from "../components/CheckinSuccessModal";
import { useCheckinModal } from "../hooks/useCheckinModal";
import sdk from "@farcaster/miniapp-sdk";
import { convertTypesenseTokenToToken, TypesenseToken } from "../lib/typesenseClient";

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typesenseResults, setTypesenseResults] = useState<Token[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const hasInitiallyFetched = useRef(false);

  // Trending carousel state
  const [trendingCarouselTokens, setTrendingCarouselTokens] = useState<Token[]>(
    []
  );
  // const [isFetchingCarousel, setIsFetchingCarousel] = useState(false);

  // Debug button state (controlled by Navbar easter egg)
  const [showDebugButton, setShowDebugButton] = useState(false);

  // Tutorial modal state
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [hasSkippedTutorial, setHasSkippedTutorial] = useState(false);
  const [hasShownTutorialThisSession, setHasShownTutorialThisSession] =
    useState(false);

  // Load tutorial skip state from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const skipped = localStorage.getItem("streme-tutorial-skipped");
      if (skipped === "true") {
        setHasSkippedTutorial(true);
      }
    }
  }, []);

  const {
    isSDKLoaded,
    farcasterContext,
    promptToAddMiniApp,
    hasPromptedToAdd,
    hasAddedMiniApp,
    switchChain,
    isSwitchingChain,
    isOnCorrectNetwork,
  } = useAppFrameLogic();

  // Use unified wallet connection logic like crowdfund page
  const {
    isConnected: unifiedIsConnected,
    address: unifiedAddress,
    connect: unifiedConnect,
    isEffectivelyMiniApp: unifiedIsMiniApp,
  } = useUnifiedWallet();

  // Use unified wallet state
  const isMiniAppView = unifiedIsMiniApp;
  const isConnected = unifiedIsConnected;
  const address = unifiedAddress;

  const postHog = usePostHog();

  // Debug mode can be activated via logo clicks in MiniAppTopNavbar
  // This is now handled through the global navigation in ClientLayout
  useEffect(() => {
    // Set up debug mode if needed for testing
    if (isMiniAppView && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("debug") === "true") {
        setShowDebugButton(true);
      }
    }
  }, [isMiniAppView]);

  // Checkin modal logic
  const {
    checkinData,
    checkinError,
    checkinLoading,
    showSuccessModal,
    showCheckinModal,
    hasCheckedIn,
    hasStakedBalance,
    performCheckin,
    closeSuccessModal,
    handleCloseCheckinModal,
    handleDebugButtonClick,
    showSuccessModalDebug,
    setShowCheckinModal,
  } = useCheckinModal({
    isMiniAppView,
    isConnected,
    isOnCorrectNetwork,
  });

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

  // Log checkin results
  useEffect(() => {
    if (checkinData) {
      console.log("Daily checkin successful:", {
        totalCheckins: checkinData.totalCheckins,
        currentStreak: checkinData.currentStreak,
        dropAmount: checkinData.dropAmount,
      });
    }
    if (checkinError) {
      console.log("Checkin error:", checkinError);
    }
  }, [checkinData, checkinError]);

  // Debug mode activation is now handled directly via handleLogoClick

  // Fetch only top 30 tokens (trending by default from API)
  const fetchTokens = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      // Fetch only first page to get top 30 tokens
      const response = await fetch(
        `/api/tokens${params.toString() ? `?${params}` : ""}`
      );
      const data: TokensResponse = await response.json();

      // Filter out blacklisted tokens and tokens with $ in name/symbol before setting state
      const filteredTokens = data.data.filter((token) => {
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

  // Fetch trending tokens for carousel
  useEffect(() => {
    const fetchCarouselTokens = async () => {
      // setIsFetchingCarousel(true);
      try {
        const trending = await fetchTrendingTokens();
        // Only show top 10 tokens in carousel
        setTrendingCarouselTokens(trending.slice(0, 10));
      } catch (error) {
        console.error("Error fetching carousel tokens:", error);
      } finally {
        // setIsFetchingCarousel(false);
      }
    };

    fetchCarouselTokens();
    // Refresh carousel every 2 minutes
    const interval = setInterval(fetchCarouselTokens, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

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

  // Show tutorial modal for first-time visitors (both mini-app and desktop)
  useEffect(() => {
    if (isMiniAppView) {
      // Mini-app logic: show if user hasn't added the app
      if (
        isSDKLoaded &&
        !hasAddedMiniApp &&
        !hasSkippedTutorial &&
        !hasShownTutorialThisSession
      ) {
        // Small delay to ensure everything is loaded
        const timer = setTimeout(() => {
          setShowTutorialModal(true);
          setHasShownTutorialThisSession(true);
          // Track tutorial modal shown
          postHog?.capture("tutorial_shown", {
            context: "farcaster_mini_app",
          });
        }, 1000);
        return () => clearTimeout(timer);
      }
    } else {
      // Desktop logic: show for first-time visitors
      if (!hasSkippedTutorial && !hasShownTutorialThisSession) {
        // Small delay to ensure everything is loaded
        const timer = setTimeout(() => {
          setShowTutorialModal(true);
          setHasShownTutorialThisSession(true);
          // Track tutorial modal shown
          postHog?.capture("tutorial_shown", {
            context: "desktop_web",
          });
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [
    isMiniAppView,
    isSDKLoaded,
    hasAddedMiniApp,
    hasSkippedTutorial,
    hasShownTutorialThisSession,
    postHog,
  ]);

  // Call ready when the mini-app is fully loaded and initialized
  useEffect(() => {
    if (isMiniAppView && isSDKLoaded && !loading) {
      console.log("🟢 Mini-app fully loaded, calling sdk.actions.ready()");
      sdk.actions.ready();
    }
  }, [isMiniAppView, isSDKLoaded, loading]);

  // Auto-connect to Farcaster wallet if not connected in mini app context
  const autoConnectAttempted = useRef(false);
  useEffect(() => {
    if (
      isMiniAppView &&
      isSDKLoaded &&
      !isConnected &&
      !autoConnectAttempted.current
    ) {
      autoConnectAttempted.current = true;
      console.log(
        "[App] Mini-app detected but not connected, attempting to connect..."
      );

      // Try to connect using the unified wallet connect function
      try {
        unifiedConnect();
        console.log("[App] Auto-connection attempt initiated");
      } catch (error) {
        console.log("[App] Auto-connection failed:", error);
      }
    }

    // Reset if we become disconnected
    if (!isMiniAppView || !isSDKLoaded) {
      autoConnectAttempted.current = false;
    }
  }, [isMiniAppView, isSDKLoaded, isConnected, unifiedConnect]);

  // Handle search results change (memoized to prevent infinite loops)
  const handleSearchResultsChange = useCallback((results: TypesenseToken[]) => {
    // Convert Typesense results to Token format
    const convertedTokens = results.map((tsToken: TypesenseToken) =>
      convertTypesenseTokenToToken(tsToken)
    );
    setTypesenseResults(convertedTokens);
  }, []);

  // Check checkin status when miniapp first opens (only after wallet is connected)
  useEffect(() => {
    const checkCheckinStatus = async () => {
      if (
        isMiniAppView &&
        isSDKLoaded &&
        farcasterContext &&
        isConnected &&
        !hasCheckedIn
      ) {
        try {
          // Try to get FID from different possible locations
          const userFid =
            farcasterContext?.user?.fid ||
            (
              farcasterContext as unknown as {
                client?: { user?: { fid?: number } };
              }
            )?.client?.user?.fid;

          if (!userFid) {
            console.log("No FID found in farcasterContext");
            return;
          }

          console.log(`Checking checkin status for FID: ${userFid}`);

          const response = await fetch(`/api/checkin/${userFid}`);
          if (response.ok) {
            const data = await response.json();
            // console.log("Checkin status:", data);

            // Only show modal if user hasn't checked in today
            if (!data.checkedInToday) {
              console.log("User hasn't checked in today, showing modal");
              // Show modal immediately since wallet is already connected
              setShowCheckinModal();
            } else {
              console.log("User has already checked in today");
            }
          } else {
            console.error("Failed to fetch checkin status:", response.status);
          }
        } catch (error) {
          console.error("Error checking checkin status:", error);
        }
      }
    };

    // Add a small delay to ensure everything is properly initialized, but only after wallet is connected
    const timer = setTimeout(checkCheckinStatus, 1000);
    return () => clearTimeout(timer);
  }, [
    isMiniAppView,
    isSDKLoaded,
    farcasterContext,
    isConnected,
    hasCheckedIn,
    setShowCheckinModal,
  ]);

  // Tutorial modal handlers
  const handleCloseTutorial = () => {
    setShowTutorialModal(false);
    // Save completion state so user doesn't see tutorial again
    if (typeof window !== "undefined") {
      localStorage.setItem("streme-tutorial-skipped", "true");
    }
    // Track tutorial completion
    postHog?.capture("tutorial_completed", {
      context: isMiniAppView ? "farcaster_mini_app" : "desktop_web",
    });
  };

  const handleSkipTutorial = () => {
    setHasSkippedTutorial(true);
    setShowTutorialModal(false);
    // Save to localStorage so user doesn't see tutorial again
    if (typeof window !== "undefined") {
      localStorage.setItem("streme-tutorial-skipped", "true");
    }
    // Track tutorial skip
    postHog?.capture("tutorial_skipped", {
      context: isMiniAppView ? "farcaster_mini_app" : "desktop_web",
    });
  };

  if (!isSDKLoaded) {
    return <div className="text-center py-8"></div>;
  }

  if (isMiniAppView) {
    return (
      <div className="font-[family-name:var(--font-geist-sans)]">
        <div className="flex flex-col gap-2 row-start-2 w-full p-4">
          {/* Your Balance Section */}
          {/* {isConnected && (
            <div className="w-full max-w-md mb-4">
              <h3 className="font-semibold text-base-content mb-2">
                Your Balance
              </h3>
              <Link href="/token/0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58">
                <div className="cursor-pointer hover:opacity-80 transition-opacity">
                  <StreamingBalance />
                </div>
              </Link>
            </div>
          )} */}

          {/* Debug Buttons - only show after logo easter egg */}
          {/* DISABLED: Free daily STREME drop feature - checkin debug buttons removed */}
          {isMiniAppView &&
            isConnected &&
            isOnCorrectNetwork &&
            showDebugButton && (
              <div className="flex flex-col gap-2 mt-2">
                {/* <Button
                  onClick={handleDebugButtonClick}
                  disabled={hasCheckedIn}
                  className="btn btn-sm btn-secondary"
                >
                  {hasCheckedIn ? "✅ Already Checked In" : "🐛 Debug Checkin"}
                </Button>
                <Button
                  onClick={showSuccessModalDebug}
                  className="btn btn-sm btn-accent"
                >
                  🎉 Debug Success Modal
                </Button> */}
                <Link href="/gda" className="btn btn-sm btn-primary">
                  🌊 GDA Page
                </Link>
                <Link href="/cfa" className="btn btn-sm btn-secondary">
                  💧 CFA Page
                </Link>
              </div>
            )}

          {/* Trending Carousel - Above filters */}
          {trendingCarouselTokens.length > 0 && !searchQuery && (
            <TrendingTokensCarousel
              tokens={trendingCarouselTokens}
              isMiniApp={true}
            />
          )}
          <h3 className="font-semibold text-base-content text-lg">
            All Streme Tokens
          </h3>

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
          <div className="flex items-center">
            <div className="flex-1 max-w-xs">
              <SearchBar
                value={searchQuery}
                onChange={(value) => setSearchQuery(value)}
                onSearchResultsChange={handleSearchResultsChange}
              />
            </div>
          </div>
          <TokenGrid
            tokens={tokens}
            searchQuery=""
            sortBy={sortBy}
            isMiniApp={true}
            isSearchMode={false}
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
        {/* <div className="fixed inset-0 -z-10">
          <HeroAnimationMini />
        </div> */}

        {/* Tutorial Modal - DISABLED */}
        {/* <MiniAppTutorialModal
          isOpen={showTutorialModal}
          onClose={handleCloseTutorial}
          onSkip={handleSkipTutorial}
        /> */}

        {/* Checkin Modal */}
        <CheckinModal
          isOpen={showCheckinModal}
          onClose={handleCloseCheckinModal}
          onCheckin={performCheckin}
          isLoading={checkinLoading}
          hasCheckedIn={hasCheckedIn}
          hasStakedBalance={hasStakedBalance}
        />

        {/* Checkin Success Modal */}
        <CheckinSuccessModal
          isOpen={showSuccessModal}
          onClose={closeSuccessModal}
          totalCheckins={checkinData?.totalCheckins}
          currentStreak={checkinData?.currentStreak}
        />
      </div>
    );
  }

  // Standard Web UI
  return (
    <>
      <div className="font-[family-name:var(--font-geist-sans)]">
        <div className="flex flex-col row-start-2 w-full items-center">
          <div className="block w-full">
            <Hero />
          </div>

          {/* Trending Carousel - Above filters */}
          <div className="w-full max-w-[1200px] px-4 mx-auto">
            {trendingCarouselTokens.length > 0 && !searchQuery && (
              <TrendingTokensCarousel
                tokens={trendingCarouselTokens}
                isMiniApp={false}
              />
            )}
          </div>

          <div className="w-full max-w-[1200px] px-4 mx-auto">
            <h3 className="font-semibold text-base-content mb-2">
              All Streme Tokens
            </h3>
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
                  onSearchResultsChange={handleSearchResultsChange}
                />
              </div>
            </div>
            {loading && tokens.length === 0 ? (
              <div className="text-center py-8">Loading tokens...</div>
            ) : (
              <TokenGrid
                tokens={tokens}
                searchQuery=""
                sortBy={sortBy}
                isMiniApp={false}
                isSearchMode={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tutorial Modal for Desktop - DISABLED */}
      {/* <MiniAppTutorialModal
        isOpen={showTutorialModal}
        onClose={handleCloseTutorial}
        onSkip={handleSkipTutorial}
      /> */}
    </>
  );
}

export default App;
