"use client";

import { TokenGrid } from "../components/TokenGrid";
import { useState, useEffect, useCallback, useRef } from "react";
import { Hero } from "../components/Hero";
import { HeroAnimationMini } from "../components/HeroAnimationMini";
import { Token, TokensResponse } from "./types/token";
import { SortOption } from "../components/TokenGrid";
import { SearchBar } from "../components/SearchBar";
import { SortButtons } from "../components/SortButtons";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";
import { Button } from "../components/ui/button";
import { base } from "wagmi/chains";
import { usePostHog } from "posthog-js/react";
import { MiniAppTutorialModal } from "../components/MiniAppTutorialModal";
import { SPAMMER_BLACKLIST } from "../lib/blacklist";
import Link from "next/link";
import Image from "next/image";
import { CheckinModal } from "../components/CheckinModal";
import { CheckinSuccessModal } from "../components/CheckinSuccessModal";
import { useCheckinModal } from "../hooks/useCheckinModal";
import sdk from "@farcaster/miniapp-sdk";

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const hasInitiallyFetched = useRef(false);

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

  // Listen for debug mode activation from Navbar easter egg
  useEffect(() => {
    const handleDebugMode = () => {
      if (isMiniAppView) {
        setShowDebugButton(true);
        console.log("Debug mode activated! Checkin button will appear.");
      }
    };

    window.addEventListener('streme-debug-activated', handleDebugMode);
    return () => window.removeEventListener('streme-debug-activated', handleDebugMode);
  }, [isMiniAppView]);

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

  // Check checkin status when miniapp first opens
  useEffect(() => {
    const checkCheckinStatus = async () => {
      if (isMiniAppView && isSDKLoaded && farcasterContext && !hasCheckedIn) {
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
              // Add another delay to ensure wallet is connected
              setTimeout(() => {
                setShowCheckinModal();
              }, 2000);
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

    // Add a small delay to ensure everything is properly initialized
    const timer = setTimeout(checkCheckinStatus, 2000);
    return () => clearTimeout(timer);
  }, [
    isMiniAppView,
    isSDKLoaded,
    farcasterContext,
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
        <div className="flex flex-col gap-2 row-start-2 w-full p-4 pt-20 pb-24">

          {/* Streaming Experiments Section */}
          <div className="w-full max-w-md mb-4">
            <h3 className="font-semibold text-base-content mb-2">
              Streme Experiments
            </h3>
            <Link href="/crowdfund">
              <div className="bg-base-100 rounded-lg shadow-md border border-base-300 overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all duration-200">
                <div className="relative h-24 bg-gradient-to-br from-primary/10 to-secondary/10 border-t border-base-300 flex items-center justify-center">
                  {/* Add hero animation mini as a background inside the card but behind the icon image */}
                  <div className="absolute inset-0 opacity-50">
                    <HeroAnimationMini />
                  </div>
                  <Image
                    src="/icon.png"
                    alt="Streme Icon"
                    width={60}
                    height={60}
                    className="opacity-80 relative z-10 rounded-full"
                  />
                </div>

                <div className="p-4 pt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-base-content/70 font-semibold">
                      Streme Growth Fund
                    </p>
                    <p className="text-sm text-base-content/70 mb-3 mr-3">
                      Contribute your staking rewards to help fund Streme growth
                      initiatives. Earn $SUP for your help!
                    </p>
                  </div>
                  <button className="btn btn-sm btn-primary">Join</button>
                </div>
              </div>
            </Link>
          </div>

          {/* Debug Buttons - only show after logo easter egg */}
          {isMiniAppView &&
            isConnected &&
            isOnCorrectNetwork &&
            showDebugButton && (
              <div className="flex flex-col gap-2 mt-2">
                <Button
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
                </Button>
                <Link href="/gda" className="btn btn-sm btn-primary">
                  🌊 GDA Page
                </Link>
                <Link href="/cfa" className="btn btn-sm btn-secondary">
                  💧 CFA Page
                </Link>
              </div>
            )}

          <div className="flex items-center">
            <h3 className="font-semibold text-base-content text-left">
              Streme Tokens
            </h3>
            <div className="flex-1 ml-3 max-w-xs">
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
        {/* <div className="fixed inset-0 -z-10">
          <HeroAnimationMini />
        </div> */}

        {/* Tutorial Modal */}
        <MiniAppTutorialModal
          isOpen={showTutorialModal}
          onClose={handleCloseTutorial}
          onSkip={handleSkipTutorial}
        />

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
          // dropAmount={checkinData?.dropAmount}
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
          <Hero />

          {/* Streaming Experiments Section */}
          <div className="w-full max-w-[1200px] px-4 my-12 mx-auto">
            <h3 className="font-semibold text-base-content mb-4 text-xl">
              Streme Experiments
            </h3>
            <Link href="/crowdfund">
              <div className="bg-base-100 rounded-lg shadow-md border border-base-300 overflow-hidden max-w-md cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all duration-200">
                <div className="relative h-32 bg-gradient-to-br from-primary/10 to-secondary/10 border-t border-base-300 flex items-center justify-center">
                  <div className="absolute inset-0 opacity-50">
                    <HeroAnimationMini />
                  </div>
                  <Image
                    src="/icon.png"
                    alt="Streme Icon"
                    width={80}
                    height={80}
                    className="opacity-80 relative z-10 rounded-full"
                  />
                </div>

                <div className="p-6 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-base text-base-content font-semibold">
                      Streme Growth Fund
                    </p>
                    <p className="text-sm text-base-content/70 mb-3">
                      Contribute your staking rewards to help fund Streme growth
                      initiatives. Earn $SUP for your contribution.
                    </p>
                  </div>
                  <button className="btn btn-primary">Join</button>
                </div>
              </div>
            </Link>
          </div>

          {/* Streme Tokens */}
          <h3 className="font-semibold text-base-content text-xl w-full max-w-[1200px] px-4 mx-auto">
            Streme Tokens
          </h3>

          <div className="w-full max-w-[1200px] px-4 mx-auto">
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

      {/* Tutorial Modal for Desktop */}
      <MiniAppTutorialModal
        isOpen={showTutorialModal}
        onClose={handleCloseTutorial}
        onSkip={handleSkipTutorial}
      />
    </>
  );
}

export default App;
