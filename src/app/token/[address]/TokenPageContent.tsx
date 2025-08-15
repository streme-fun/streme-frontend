"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TokenActions } from "./TokenActions";
import { Token } from "@/src/app/types/token";
import { TokenInfo } from "./TokenInfo";
import { StakedBalance } from "@/src/components/StakedBalance";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import sdk from "@farcaster/miniapp-sdk";
import { HeroAnimationMini } from "@/src/components/HeroAnimationMini";
import { StakerLeaderboard } from "@/src/components/StakerLeaderboard";
import { StakerLeaderboardEmbed } from "@/src/components/StakerLeaderboardEmbed";
import { ClaimFeesButton } from "@/src/components/ClaimFeesButton";

// Interface for GeckoTerminal market data
interface GeckoTerminalData {
  price: number;
  change1h: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export function TokenPageContent() {
  const params = useParams();
  const pageAddress = params.address as string;
  const [token, setToken] = useState<Token | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stakingUpdateTrigger, setStakingUpdateTrigger] = useState(0);
  const [isStakerLeaderboardOpen, setIsStakerLeaderboardOpen] = useState(false);
  const [userStakedBalance, setUserStakedBalance] = useState<bigint>(0n);

  const {
    isSDKLoaded,
    isMiniAppView,
    address,
    isConnected,
    promptToAddMiniApp,
    hasPromptedToAdd,
  } = useAppFrameLogic();

  const router = useRouter();

  // Function to fetch GeckoTerminal market data
  const fetchGeckoTerminalData = async (
    poolAddress: string
  ): Promise<GeckoTerminalData | null> => {
    try {
      const response = await fetch(
        `/api/geckoterminal?poolAddress=${poolAddress}`
      );
      if (!response.ok) {
        console.warn(`GeckoTerminal API failed with status ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data.error || !data?.data?.attributes) {
        console.warn("Invalid GeckoTerminal response:", data);
        return null;
      }

      const attrs = data.data.attributes;

      // Helper to clean percentage strings
      const cleanPercentage = (str: string) =>
        parseFloat(str.replace(/%/g, "").replace(/[+]/g, ""));

      return {
        price: parseFloat(attrs.price_in_usd || "0"),
        change1h: cleanPercentage(attrs.price_percent_changes?.last_1h || "0"),
        change24h: cleanPercentage(
          attrs.price_percent_changes?.last_24h || "0"
        ),
        volume24h: parseFloat(attrs.from_volume_in_usd || "0"),
        marketCap: parseFloat(attrs.fully_diluted_valuation || "0"),
      };
    } catch (error) {
      console.error("Error fetching GeckoTerminal data:", error);
      return null;
    }
  };

  useEffect(() => {
    async function fetchToken() {
      if (!pageAddress) {
        setTokenLoading(false);
        return;
      }

      try {
        setTokenLoading(true);
        const response = await fetch(
          `/api/tokens/single?address=${pageAddress}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.data) {
          const baseToken = data.data;

          // Fetch more accurate market data from GeckoTerminal
          const geckoData = await fetchGeckoTerminalData(
            baseToken.pool_address
          );

          // Merge the data, preferring GeckoTerminal for market data when available
          const enhancedToken: Token = {
            ...baseToken,
            price: geckoData?.price ?? baseToken.price,
            change1h: geckoData?.change1h ?? baseToken.change1h,
            change24h: geckoData?.change24h ?? baseToken.change24h,
            volume24h: geckoData?.volume24h ?? baseToken.volume24h,
            marketCap: geckoData?.marketCap ?? baseToken.marketCap,
          };

          setToken(enhancedToken);
        } else {
          throw new Error("No token data found");
        }
      } catch (err) {
        console.error("Error fetching token:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch token data"
        );
      } finally {
        setTokenLoading(false);
      }
    }

    fetchToken();
  }, [pageAddress]);

  // Prompt to add mini app when in mini app view
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

  // Call ready when the component is fully loaded in mini app view
  useEffect(() => {
    if (isMiniAppView && isSDKLoaded && !tokenLoading && token) {
      sdk.actions.ready();
    }
  }, [isMiniAppView, isSDKLoaded, tokenLoading, token]);

  const handleStakingChange = () => {
    setStakingUpdateTrigger((prev) => prev + 1);
  };

  const handleStakedBalanceUpdate = (balance: bigint) => {
    setUserStakedBalance(balance);
  };

  const handleShare = async () => {
    if (!token) return;

    // Simplified market cap formatting without commas
    const formatMarketCap = (marketCap: string | number | undefined) => {
      if (!marketCap) return "N/A";
      const value = parseFloat(marketCap.toString());
      if (isNaN(value)) return "N/A";

      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
      } else {
        return `$${value.toFixed(0)}`;
      }
    };

    const shareUrl = `https://streme.fun/token/${pageAddress}`;

    // Simplified cast text with single newlines and no complex formatting
    const castText = `Check out $${token.symbol} on Streme! 🚀

Market Cap: ${formatMarketCap(token.marketCap)}

${shareUrl}`;

    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: castText,
          embeds: [shareUrl],
        });
      } catch (error) {
        console.error("Error composing cast:", error);
        // Fallback to opening Farcaster
        window.open(
          `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
            castText
          )}&embeds[]=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
      }
    } else {
      // Desktop version - open Farcaster web compose
      window.open(
        `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
          castText
        )}&embeds[]=${encodeURIComponent(shareUrl)}`,
        "_blank"
      );
    }
  };

  if (!isSDKLoaded) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="loading loading-bars loading-lg text-primary">
            Loading SDK...
          </div>
        </div>
      </div>
    );
  }

  if (tokenLoading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="loading loading-bars loading-lg text-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-base-content/70">{error || "Token not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const embedUrl =
    pageAddress.toLowerCase() ===
    "0x1234567890123456789012345678901234567890".toLowerCase()
      ? "https://www.geckoterminal.com/base/pools/0x1035ae3f87a91084c6c5084d0615cc6121c5e228?embed=1&info=0&swaps=1&grayscale=0&light_chart=0"
      : `https://www.geckoterminal.com/base/pools/${token.pool_address}?embed=1&info=0&swaps=1&grayscale=0&light_chart=0`;

  const smallEmbedUrl =
    pageAddress.toLowerCase() ===
    "0x1234567890123456789012345678901234567890".toLowerCase()
      ? "https://www.geckoterminal.com/base/pools/0x1035ae3f87a91084c6c5084d0615cc6121c5e228?embed=1&info=0&swaps=0&grayscale=0&light_chart=0"
      : `https://www.geckoterminal.com/base/pools/${token.pool_address}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0`;

  return (
    <div className="max-w-[1440px] mx-auto sm:px-6 md:px-8 md:mt-0 pt-28 pb-12">
      {/* Back Arrow Button - Only show in mini app */}
      {isMiniAppView && (
        <div className="mb-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content transition-colors cursor-pointer"
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
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        <div className="order-1 lg:order-2 lg:col-span-4 space-y-4">
          <TokenInfo
            token={token}
            onShare={handleShare}
            isMiniAppView={isMiniAppView}
          />

          <TokenActions
            data-trading-section
            token={token}
            onStakingChange={handleStakingChange}
            onStakedBalanceUpdate={handleStakedBalanceUpdate}
            isMiniAppView={isMiniAppView}
            address={address}
            isConnected={isConnected}
          />
          <StakedBalance
            data-staking-balance
            stakingAddress={token.staking_address}
            stakingPool={token.staking_pool}
            symbol={token.symbol}
            tokenAddress={token.contract_address}
            tokenLaunchTime={
              token.timestamp
                ? new Date(
                    token.timestamp._seconds * 1000 +
                      token.timestamp._nanoseconds / 1000000
                  )
                : token.created_at
            }
            key={stakingUpdateTrigger}
          />

          {/* Embedded Staker Leaderboard */}
          <StakerLeaderboardEmbed
            stakingPoolAddress={token.staking_pool}
            tokenAddress={token.contract_address}
            tokenSymbol={token.symbol}
            stakingAddress={token.staking_address}
            onViewAll={() => setIsStakerLeaderboardOpen(true)}
            onStakingChange={handleStakingChange}
            tokenPrice={token.price}
            userStakedBalance={userStakedBalance}
          />

          {/* Claim Fees Button */}
          <ClaimFeesButton tokenAddress={token.contract_address} />
        </div>

        <div className="order-2 lg:order-1 lg:col-span-8 card bg-base-100 border border-black/[.1] dark:border-white/[.1] h-fit lg:sticky lg:top-28">
          <div className="card-body p-0 md:p-4 pb-12">
            <iframe
              data-privy-ignore
              title="GeckoTerminal Embed"
              src={isMiniAppView ? smallEmbedUrl : embedUrl}
              className="w-full h-[500px] lg:h-[800px]"
              allow="clipboard-write"
              allowFullScreen
            />
          </div>
        </div>
      </div>
      <div className="fixed inset-0 -z-50">
        <HeroAnimationMini />
      </div>

      {/* Staker Leaderboard Modal */}
      <StakerLeaderboard
        stakingPoolAddress={token.staking_pool}
        tokenSymbol={token.symbol}
        isOpen={isStakerLeaderboardOpen}
        onClose={() => setIsStakerLeaderboardOpen(false)}
      />
    </div>
  );
}
