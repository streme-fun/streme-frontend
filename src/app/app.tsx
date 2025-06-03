"use client";

import { TokenGrid } from "../components/TokenGrid";
// import { ViewSwitcher } from "./components/ViewSwitcher";
import { useState, useEffect, useCallback, useRef } from "react";
import { Hero } from "../components/Hero";
import { HeroAnimationMini } from "../components/HeroAnimationMini";
import { TopStreamer } from "../components/TopStreamer";
import { Token, TokensResponse } from "./types/token";
import { SortOption } from "../components/TokenGrid";
import { SearchBar } from "../components/SearchBar";
// import { sdk } from "@farcaster/frame-sdk"; // No longer directly needed here for init
import { useAppFrameLogic } from "../hooks/useAppFrameLogic"; // Import the new hook
import { Button } from "../components/ui/button"; // Corrected import path based on file structure
import { base } from "wagmi/chains"; // Only base needed here now
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react"; // Added PostHog hook
// import { truncateAddressShort } from "../lib/truncateAddress";

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
  } = useAppFrameLogic(); // Use the hook

  const postHog = usePostHog(); // Use the PostHog hook

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

  const fetchTokens = useCallback(async (before?: number) => {
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
  }, []);

  useEffect(() => {
    // Only fetch if we haven't fetched yet and conditions are met
    if (
      (!isMiniAppView || (isMiniAppView && isOnCorrectNetwork)) &&
      !hasInitiallyFetched.current &&
      tokens.length === 0 // Additional check to prevent refetch if we already have tokens
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
  // According to Farcaster docs: "If a user already has a connected wallet the connector will automatically connect to it"
  useEffect(() => {
    if (isMiniAppView && !isConnected && farcasterContext && isSDKLoaded) {
      // In Farcaster context, the connector should auto-connect if wallet is available
      // If not connected, we need to prompt the user to connect
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
            <svg
              width="106"
              height="15"
              viewBox="0 0 212 31"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              onClick={handleDebugClick}
              className="cursor-pointer"
              style={{
                opacity: debugClickCount > 0 ? 0.5 + debugClickCount * 0.1 : 1,
              }}
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
                d="M168.741 30.1847C168.273 30.1847 167.87 30.0189 167.534 29.6875C167.203 29.3513 167.037 28.9489 167.037 28.4801C167.037 28.0161 167.203 27.6184 167.534 27.2869C167.87 26.9555 168.273 26.7898 168.741 26.7898C169.196 26.7898 169.594 26.9555 169.935 27.2869C170.276 27.6184 170.446 28.0161 170.446 28.4801C170.446 28.7926 170.366 29.0791 170.205 29.3395C170.048 29.5952 169.842 29.8011 169.587 29.9574C169.331 30.1089 169.049 30.1847 168.741 30.1847Z"
                className="fill-primary"
              />
              <path
                d="M172.987 30V15.4545H182.618V17.9901H176.062V21.456H181.978V23.9915H176.062V30H172.987Z"
                className="fill-accent"
              />
              <path
                d="M193.67 15.4545H196.746V24.9006C196.746 25.9612 196.492 26.8892 195.986 27.6847C195.484 28.4801 194.781 29.1004 193.876 29.5455C192.972 29.9858 191.919 30.206 190.716 30.206C189.509 30.206 188.453 29.9858 187.548 29.5455C186.644 29.1004 185.941 28.4801 185.439 27.6847C184.937 26.8892 184.686 25.9612 184.686 24.9006V15.4545H187.761V24.6378C187.761 25.1918 187.882 25.6842 188.124 26.1151C188.37 26.5459 188.715 26.8845 189.161 27.1307C189.606 27.3769 190.124 27.5 190.716 27.5C191.313 27.5 191.831 27.3769 192.271 27.1307C192.716 26.8845 193.06 26.5459 193.301 26.1151C193.547 25.6842 193.67 25.1918 193.67 24.6378V15.4545Z"
                className="fill-accent"
              />
              <path
                d="M211.442 15.4545V30H208.786L202.458 20.8452H202.351V30H199.276V15.4545H201.975L208.253 24.6023H208.381V15.4545H211.442Z"
                className="fill-accent"
              />
              <path
                d="M81.6143 30V25.071H101.501V30H81.6143ZM84.0433 17.6847V12.9261H99.1712V17.6847H84.0433ZM82.1541 5.90909V0.90909H100.592V5.90909H82.1541Z"
                className="fill-secondary"
              />
            </svg>
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
                <div className="join w-full">
                  {(
                    ["trending", "newest", "oldest", "stakers"] as SortOption[]
                  ).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`btn btn-sm join-item flex-1 ${
                        sortBy === option ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {option === "trending" && "Trending"}
                      {option === "newest" && "Newest"}
                      {option === "oldest" && "Oldest"}
                      {option === "stakers" && "Stakers"}
                    </button>
                  ))}
                </div>
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
                <div className="join">
                  {(
                    ["trending", "newest", "oldest", "stakers"] as SortOption[]
                  ).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`btn btn-sm join-item ${
                        sortBy === option ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {option === "trending" && "Trending"}
                      {option === "newest" && "Newest"}
                      {option === "oldest" && "Oldest"}
                      {option === "stakers" && "Most Stakers"}
                    </button>
                  ))}
                </div>
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
