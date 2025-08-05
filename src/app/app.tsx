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
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckinModal } from "../components/CheckinModal";
import { CheckinSuccessModal } from "../components/CheckinSuccessModal";
import { useCheckinModal } from "../hooks/useCheckinModal";
import { StreamingBalance } from "../components/StreamingBalance";
import sdk from "@farcaster/miniapp-sdk";

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const hasInitiallyFetched = useRef(false);

  // Easter egg state for mini-app logo clicking
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [lastLogoClickTime, setLastLogoClickTime] = useState(0);
  const [showDebugButton, setShowDebugButton] = useState(false);
  const router = useRouter();

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

  // Easter egg function for mini-app logo clicking
  const handleLogoClick = useCallback(() => {
    const now = Date.now();
    const timeSinceLastClick = now - lastLogoClickTime;

    // Reset count if too much time has passed (2 seconds)
    if (timeSinceLastClick > 2000) {
      setLogoClickCount(1);
    } else {
      setLogoClickCount((prev) => prev + 1);
    }

    setLastLogoClickTime(now);

    // Show debug button on 5th click for mini-app, navigate to growth fund for web
    if (logoClickCount + 1 >= 5) {
      if (isMiniAppView) {
        setShowDebugButton(true);
        console.log("Debug mode activated! Checkin button will appear.");
      } else {
        router.push("/crowdfund");
      }
      setLogoClickCount(0);
    }
  }, [logoClickCount, lastLogoClickTime, isMiniAppView, router]);

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
        <div className="flex flex-col gap-2 row-start-2 w-full p-4 py-20">
          <div className="fixed top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-base-100/80 backdrop-blur-sm">
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center">
                <svg
                  width="100"
                  height="17"
                  viewBox="0 0 391 72"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  onClick={handleLogoClick}
                  className="cursor-pointer"
                >
                  <path
                    d="M40.1619 21.2614C39.8892 18.5114 38.7188 16.375 36.6506 14.8523C34.5824 13.3295 31.7756 12.5682 28.2301 12.5682C25.821 12.5682 23.7869 12.9091 22.1278 13.5909C20.4688 14.25 19.196 15.1705 18.3097 16.3523C17.446 17.5341 17.0142 18.875 17.0142 20.375C16.9688 21.625 17.2301 22.7159 17.7983 23.6477C18.3892 24.5795 19.196 25.3864 20.2188 26.0682C21.2415 26.7273 22.4233 27.3068 23.7642 27.8068C25.1051 28.2841 26.5369 28.6932 28.0597 29.0341L34.3324 30.5341C37.3778 31.2159 40.1733 32.125 42.7188 33.2614C45.2642 34.3977 47.4688 35.7955 49.3324 37.4545C51.196 39.1136 52.6392 41.0682 53.6619 43.3182C54.7074 45.5682 55.2415 48.1477 55.2642 51.0568C55.2415 55.3295 54.1506 59.0341 51.9915 62.1705C49.8551 65.2841 46.7642 67.7045 42.7188 69.4318C38.696 71.1364 33.8438 71.9886 28.1619 71.9886C22.5256 71.9886 17.6165 71.125 13.4347 69.3977C9.27557 67.6705 6.02557 65.1136 3.68466 61.7273C1.36648 58.3182 0.150568 54.1023 0.0369318 49.0795H14.321C14.4801 51.4205 15.1506 53.375 16.3324 54.9432C17.5369 56.4886 19.1392 57.6591 21.1392 58.4545C23.1619 59.2273 25.446 59.6136 27.9915 59.6136C30.4915 59.6136 32.6619 59.25 34.5028 58.5227C36.3665 57.7955 37.8097 56.7841 38.8324 55.4886C39.8551 54.1932 40.3665 52.7045 40.3665 51.0227C40.3665 49.4545 39.9006 48.1364 38.9688 47.0682C38.0597 46 36.7188 45.0909 34.946 44.3409C33.196 43.5909 31.0483 42.9091 28.5028 42.2955L20.9006 40.3864C15.0142 38.9545 10.3665 36.7159 6.95739 33.6705C3.5483 30.625 1.85511 26.5227 1.87784 21.3636C1.85511 17.1364 2.98011 13.4432 5.25284 10.2841C7.5483 7.125 10.696 4.65909 14.696 2.88636C18.696 1.11363 23.2415 0.22727 28.3324 0.22727C33.5142 0.22727 38.0369 1.11363 41.9006 2.88636C45.7869 4.65909 48.8097 7.125 50.9688 10.2841C53.1278 13.4432 54.2415 17.1023 54.3097 21.2614H40.1619ZM62.5341 13.3523V1.18182H119.875V13.3523H98.5V71H83.9091V13.3523H62.5341ZM129.318 71V1.18182H156.864C162.136 1.18182 166.636 2.125 170.364 4.01136C174.114 5.875 176.966 8.52273 178.92 11.9545C180.898 15.3636 181.886 19.375 181.886 23.9886C181.886 28.625 180.886 32.6136 178.886 35.9545C176.886 39.2727 173.989 41.8182 170.193 43.5909C166.42 45.3636 161.852 46.25 156.489 46.25H138.045V34.3864H154.102C156.92 34.3864 159.261 34 161.125 33.2273C162.989 32.4545 164.375 31.2955 165.284 29.75C166.216 28.2045 166.682 26.2841 166.682 23.9886C166.682 21.6705 166.216 19.7159 165.284 18.125C164.375 16.5341 162.977 15.3295 161.091 14.5114C159.227 13.6705 156.875 13.25 154.034 13.25H144.08V71H129.318ZM167.023 39.2273L184.375 71H168.08L151.102 39.2273H167.023ZM255.224 1.18182H273.429L292.656 48.0909H293.474L312.702 1.18182H330.906V71H316.588V25.5568H316.009L297.94 70.6591H288.19L270.122 25.3864H269.543V71H255.224V1.18182ZM343.068 71V1.18182H390.114V13.3523H357.83V29.9886H387.693V42.1591H357.83V58.8295H390.25V71H343.068Z"
                    className="fill-primary"
                  />
                  <path
                    d="M193.818 71V59.1705H241.545V71H193.818ZM199.648 41.4432V30.0227H235.955V41.4432H199.648ZM195.114 13.1818V1.18182H239.364V13.1818H195.114Z"
                    className="fill-secondary"
                  />
                </svg>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {isConnected && (
                <Link href="/token/0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58">
                  <div className="bg-base-100/90 backdrop-blur-sm rounded-lg px-3 py-2 cursor-pointer hover:bg-base-100 transition-colors">
                    <StreamingBalance />
                  </div>
                </Link>
              )}
              <button
                onClick={() => {
                  setShowTutorialModal(true);
                  postHog?.capture("tutorial_opened", {
                    context: "farcaster_mini_app",
                    opened_by: "help_button",
                  });
                }}
                className="btn btn-ghost btn-circle btn-sm flex-shrink-0"
                title="Tutorial"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
          </div>

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
