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
    hasAddedMiniApp,
  } = useAppFrameLogic();

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

    // Show debug button on 5th click for mini-app, navigate to marketing fund for web
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
            console.log("Checkin status:", data);

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
    return <div className="text-center py-8">Loading SDK...</div>;
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
            <div className="flex-shrink-0">
              <button
                onClick={() => {
                  setShowTutorialModal(true);
                  postHog?.capture("tutorial_opened", {
                    context: "farcaster_mini_app",
                    opened_by: "help_button",
                  });
                }}
                className="btn btn-ghost btn-circle btn-sm"
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
                  <div className="absolute inset-0 opacity-30">
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
                      Streme Marketing Fund
                    </p>
                    <p className="text-sm text-base-content/70 mb-3 mr-3">
                      Contribute your staking rewards to help fund Streme marketing
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
          dropAmount={checkinData?.dropAmount}
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
          {/* Desktop Logo Header */}
          <div className="w-full max-w-[1200px] px-4 mx-auto mt-8 mb-4">
            <Link href="/" className="flex items-center justify-center">
              <svg
                width="212"
                height="31"
                viewBox="0 0 212 31"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                onClick={handleLogoClick}
                className="cursor-pointer"
              >
                <path
                  d="M17.5909 9.27557C17.4773 8.12973 16.9896 7.23958 16.1278 6.60511C15.2661 5.97064 14.0966 5.65341 12.6193 5.65341C11.6155 5.65341 10.768 5.79545 10.0767 6.07955C9.38542 6.35417 8.85511 6.73769 8.4858 7.23011C8.12595 7.72254 7.94602 8.28125 7.94602 8.90625C7.92708 9.42708 8.03598 9.88163 8.27273 10.2699C8.51894 10.6581 8.85511 10.9943 9.28125 11.2784C9.70739 11.553 10.1998 11.7945 10.7585 12.0028C11.3172 12.2017 11.9138 12.3722 12.5483 12.5142L15.1619 13.1392C16.4309 13.4233 17.5956 13.8021 18.6562 14.2756C19.7169 14.7491 20.6354 15.3314 21.4119 16.0227C22.1884 16.714 22.7898 17.5284 23.2159 18.4659C23.6515 19.4034 23.8741 20.4782 23.8835 21.6903C23.8741 23.4706 23.4195 25.0142 22.5199 26.321C21.6297 27.6184 20.3419 28.6269 18.6562 29.3466C16.9801 30.0568 14.9583 30.4119 12.5909 30.4119C10.2424 30.4119 8.19697 30.0521 6.45455 29.3324C4.72159 28.6127 3.36742 27.5473 2.39205 26.1364C1.42614 24.7159 0.919508 22.9593 0.872159 20.8665H6.82386C6.89015 21.8419 7.16951 22.6562 7.66193 23.3097C8.16383 23.9536 8.83144 24.4413 9.66477 24.7727C10.5076 25.0947 11.4593 25.2557 12.5199 25.2557C13.5616 25.2557 14.4659 25.1042 15.233 24.8011C16.0095 24.4981 16.6108 24.0767 17.0369 23.5369C17.4631 22.9972 17.6761 22.3769 17.6761 21.6761C17.6761 21.0227 17.482 20.4735 17.0938 20.0284C16.715 19.5833 16.1563 19.2045 15.4176 18.892C14.6884 18.5795 13.7936 18.2955 12.733 18.0398L9.56534 17.2443C7.11269 16.6477 5.17614 15.715 3.75568 14.446C2.33523 13.1771 1.62973 11.4678 1.6392 9.31818C1.62973 7.55682 2.09848 6.01799 3.04545 4.7017C4.00189 3.38542 5.31345 2.35795 6.98011 1.61932C8.64678 0.880681 10.5407 0.511363 12.6619 0.511363C14.821 0.511363 16.7055 0.880681 18.3153 1.61932C19.9347 2.35795 21.1941 3.38542 22.0938 4.7017C22.9934 6.01799 23.4574 7.54261 23.4858 9.27557H17.5909Z"
                  className="fill-primary"
                />
                <path
                  d="M26.9126 5.98011V0.90909H50.8047V5.98011H41.8984V30H35.8189V5.98011H26.9126Z"
                  className="fill-primary"
                />
                <path
                  d="M54.7393 30V0.90909H66.2166C68.4136 0.90909 70.2886 1.30208 71.8416 2.08807C73.4041 2.86458 74.5926 3.9678 75.407 5.39773C76.2308 6.81818 76.6428 8.48958 76.6428 10.4119C76.6428 12.3437 76.2261 14.0057 75.3928 15.3977C74.5594 16.7803 73.352 17.8409 71.7706 18.5795C70.1986 19.3182 68.2952 19.6875 66.0604 19.6875H58.3757V14.7443H65.0661C66.2403 14.7443 67.2157 14.5833 67.9922 14.2614C68.7687 13.9394 69.3464 13.4564 69.7251 12.8125C70.1134 12.1686 70.3075 11.3684 70.3075 10.4119C70.3075 9.44602 70.1134 8.63163 69.7251 7.96875C69.3464 7.30587 68.764 6.80398 67.978 6.46307C67.2015 6.11269 66.2214 5.9375 65.0376 5.9375H60.8899V30H54.7393Z"
                  className="fill-primary"
                />
                <path
                  d="M70.4496 16.7614L77.6797 30H70.8899L63.8161 16.7614H70.4496Z"
                  className="fill-primary"
                />
                <path
                  d="M107.2 0.90909H114.786L122.797 20.4545H123.138L131.149 0.90909H138.734V30H132.768V11.0653H132.527L124.999 29.858H120.936L113.408 10.9943H113.166V30H107.2V0.90909Z"
                  className="fill-primary"
                />
                <path
                  d="M143.802 30V0.90909H163.404V5.98011H149.952V12.9119H162.396V17.983H149.952V24.929H163.461V30H143.802Z"
                  className="fill-primary"
                />

                <path
                  d="M81.6143 30V25.071H101.501V30H81.6143ZM84.0433 17.6847V12.9261H99.1712V17.6847H84.0433ZM82.1541 5.90909V0.90909H100.592V5.90909H82.1541Z"
                  className="fill-secondary"
                />
              </svg>
            </Link>
          </div>
          <Hero />

          {/* Streaming Experiments Section */}
          <div className="w-full max-w-[1200px] px-4 my-12 mx-auto">
            <h3 className="font-semibold text-base-content mb-4 text-xl">
              Streme Experiments
            </h3>
            <Link href="/crowdfund">
              <div className="bg-base-100 rounded-lg shadow-md border border-base-300 overflow-hidden max-w-md cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all duration-200">
                <div className="relative h-32 bg-gradient-to-br from-primary/10 to-secondary/10 border-t border-base-300 flex items-center justify-center">
                  <div className="absolute inset-0 opacity-30">
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
                      Streme Marketing Fund
                    </p>
                    <p className="text-sm text-base-content/70 mb-3">
                      Contribute your staking rewards to help fund Streme marketing
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
