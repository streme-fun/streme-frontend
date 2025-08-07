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
import { MiniAppTopNavbar } from "../components/MiniAppTopNavbar";
import { HowItWorksModal } from "../components/HowItWorksModal";
import { LaunchTokenModal } from "../components/LaunchTokenModal";
import { LeaderboardModal } from "../components/LeaderboardModal";
import { WalletProfileModal } from "../components/WalletProfileModal";
import { MyTokensModal } from "../components/MyTokensModal";
import sdk from "@farcaster/miniapp-sdk";

// Client-side function to fetch user data from our API (moved from Navbar)
const fetchNeynarUser = async (fid: number) => {
  try {
    const response = await fetch(`/api/neynar/user/${fid}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching user from API:", error);
    return null;
  }
};

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

  // Easter egg state for logo clicking (moved from Navbar)
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [lastLogoClickTime, setLastLogoClickTime] = useState(0);

  // Modal states (moved from Navbar)
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  const [isWalletProfileOpen, setIsWalletProfileOpen] = useState(false);
  const [isMyStakesOpen, setIsMyStakesOpen] = useState(false);

  // Profile picture and user data state for mini-app (moved from Navbar)
  const [miniAppProfileImage, setMiniAppProfileImage] = useState<string>("");
  const [miniAppUserData, setMiniAppUserData] = useState<{
    displayName: string;
    username: string;
    profileImage: string;
  } | null>(null);

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

  // Easter egg function for logo clicking (moved from Navbar)
  const handleLogoClick = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastLogoClickTime;

    // Reset count if too much time has passed (2 seconds)
    if (timeSinceLastClick > 2000) {
      setLogoClickCount(1);
    } else {
      setLogoClickCount((prev) => prev + 1);
    }

    setLastLogoClickTime(now);

    // Show debug button on 5th click for mini-app
    if (logoClickCount + 1 >= 5) {
      if (isMiniAppView) {
        setShowDebugButton(true);
        console.log("Debug mode activated! Checkin button will appear.");
      }
      setLogoClickCount(0);
    }
  };

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

  // Fetch profile picture and user data for mini-app view (moved from Navbar)
  useEffect(() => {
    const fetchMiniAppProfile = async () => {
      if (!isMiniAppView || !farcasterContext?.user?.fid) {
        setMiniAppProfileImage("");
        setMiniAppUserData(null);
        return;
      }

      try {
        const neynarUser = await fetchNeynarUser(farcasterContext.user.fid);
        if (neynarUser) {
          const profileImage = neynarUser.pfp_url || "";
          const displayName = neynarUser.display_name || neynarUser.username || "Anonymous User";
          const username = neynarUser.username || "";
          
          setMiniAppProfileImage(profileImage);
          setMiniAppUserData({
            displayName,
            username,
            profileImage,
          });
        }
      } catch (error) {
        console.error("Error fetching mini-app profile:", error);
        setMiniAppProfileImage("");
        setMiniAppUserData(null);
      }
    };

    fetchMiniAppProfile();
  }, [isMiniAppView, farcasterContext?.user?.fid]);

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

  // Check checkin status when miniapp first opens (only after wallet is connected)
  useEffect(() => {
    const checkCheckinStatus = async () => {
      if (isMiniAppView && isSDKLoaded && farcasterContext && isConnected && !hasCheckedIn) {
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
        {/* Top Navbar */}
        <MiniAppTopNavbar 
          isConnected={isConnected}
          onLogoClick={handleLogoClick}
          onTutorialClick={() => setShowTutorialModal(true)}
        />
        
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
                      Contribute your staking rewards to fund Streme growth
                      initiatives. Earn $SUP for your help!
                    </p>
                  </div>
                  <button className="btn btn-sm btn-primary">Join</button>
                </div>
              </div>
            </Link>
          </div>

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

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 pb-4 pt-2 bg-background/80 border-t border-black/[.1] bg-base-100 bg-opacity-80">
          <div className="px-2 sm:px-4 py-2 flex items-center justify-around gap-1 sm:gap-2">
            {/* Explore Button */}
            <Link
              href="/"
              className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer"
            >
              {/* Placeholder for Home Icon */}
              <svg
                className="w-6 h-6 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                ></path>
              </svg>
              Home
            </Link>

            {/* My Stakes Button */}
            <button
              onClick={() => setIsMyStakesOpen(true)}
              className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer"
            >
              {/* Special E Icon in Circle */}
              <div className="w-6 h-6 mb-0.5 rounded-full border-2 border-current flex items-center justify-center">
                <svg
                  className="w-2 h-3"
                  viewBox="0 0 21 30"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0.54794 30V25.071H20.4343V30H0.54794ZM2.97692 17.6847V12.9261H18.1048V17.6847H2.97692ZM1.08771 5.90909V0.90909H19.5252V5.90909H1.08771Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              My Tokens
            </button>

            {/* Launch Button */}
            <button
              onClick={async () => {
                if (isSDKLoaded && sdk) {
                  try {
                    const castText = `@streme Launch a token for me

Name: [your token name]
Symbol: $[your ticker]

[Don't forget to attach an image!] 🎨`;
                    await sdk.actions.composeCast({
                      text: castText,
                      embeds: [],
                    });
                  } catch (error) {
                    console.error("Error composing cast:", error);
                    setIsCreateTokenOpen(true);
                  }
                } else {
                  console.warn(
                    "Farcaster SDK not loaded or sdk not available. Opening CreateTokenModal as fallback."
                  );
                  setIsCreateTokenOpen(true);
                }
              }}
              className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer"
            >
              {/* Placeholder for Launch Icon */}
              <svg
                className="w-6 h-6 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                ></path>
              </svg>
              Launch
            </button>

            {/* Leaderboard Button */}
            <button
              onClick={() => {
                setIsLeaderboardModalOpen(true);
              }}
              className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer"
            >
              {/* Placeholder for Leaderboard Icon */}
              <svg
                className="w-6 h-6 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                ></path>
              </svg>
              SUP Claims
            </button>

            {/* Profile Button */}
            <button
              onClick={() => setIsWalletProfileOpen(true)}
              className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer"
            >
              {/* Profile Picture or Default Icon */}
              {miniAppProfileImage ? (
                <div className="relative w-6 h-6 mb-0.5 rounded-full overflow-hidden">
                  <Image
                    src={miniAppProfileImage}
                    alt="Profile"
                    fill
                    className="object-cover"
                    unoptimized={
                      miniAppProfileImage.includes(".gif") ||
                      miniAppProfileImage.includes("imagedelivery.net")
                    }
                  />
                </div>
              ) : (
                <svg
                  className="w-6 h-6 mb-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  ></path>
                </svg>
              )}
              Profile
            </button>
          </div>
        </nav>

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

        {/* Modals moved from Navbar */}
        <HowItWorksModal
          isOpen={isHowItWorksOpen}
          onClose={() => setIsHowItWorksOpen(false)}
        />
        <LaunchTokenModal
          isOpen={isCreateTokenOpen}
          onClose={() => setIsCreateTokenOpen(false)}
        />
        <LeaderboardModal
          isOpen={isLeaderboardModalOpen}
          onClose={() => setIsLeaderboardModalOpen(false)}
        />
        <WalletProfileModal
          isOpen={isWalletProfileOpen}
          onClose={() => setIsWalletProfileOpen(false)}
          preloadedUserData={miniAppUserData}
        />
        <MyTokensModal
          isOpen={isMyStakesOpen}
          onClose={() => setIsMyStakesOpen(false)}
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
