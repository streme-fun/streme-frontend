"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackButton from "@/src/components/BackButton";
import { TokenActions } from "./TokenActions";
import { TokenInfo } from "./TokenInfo";
import { StakedBalance } from "@/src/components/StakedBalance";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import sdk from "@farcaster/miniapp-sdk";
import { HeroAnimationMini } from "@/src/components/HeroAnimationMini";
import { StakerLeaderboard } from "@/src/components/StakerLeaderboard";
import { StakerLeaderboardEmbed } from "@/src/components/StakerLeaderboardEmbed";
import { ClaimFeesButton } from "@/src/components/ClaimFeesButton";
import { useTokenData } from "@/src/contexts/TokenPageContext";

export function TokenPageContent() {
  const [stakingUpdateTrigger, setStakingUpdateTrigger] = useState(0);
  const [isStakerLeaderboardOpen, setIsStakerLeaderboardOpen] = useState(false);
  const [userStakedBalance, setUserStakedBalance] = useState<bigint>(0n);

  // Use shared token data from context
  const { token, isLoading: tokenLoading, error } = useTokenData();

  const {
    isSDKLoaded,
    isMiniAppView,
    address,
    isConnected,
    promptToAddMiniApp,
    hasPromptedToAdd,
  } = useAppFrameLogic();

  const params = useParams();
  const pageAddress = params.address as string;



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
    <div className="max-w-[1440px] mx-auto sm:px-6 mt-6 md:px-8 md:mt-0 md:pt-28 pb-12">
      <BackButton isMiniAppView={isMiniAppView} className="mb-4" />

      <div className={isMiniAppView ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-3 gap-4"}>
        {/* Left Column: Token Info + Chart (or full width in mini-app) */}
        <div className={isMiniAppView ? "space-y-4" : "lg:col-span-2 space-y-4"}>
          {/* Token Info */}
          <TokenInfo
            token={token}
            onShare={handleShare}
            isMiniAppView={isMiniAppView}
          />

          {/* Trading Actions - Above chart in mini-app view */}
          {isMiniAppView && (
            <TokenActions
              data-trading-section
              token={token}
              onStakingChange={handleStakingChange}
              onStakedBalanceUpdate={handleStakedBalanceUpdate}
              isMiniAppView={isMiniAppView}
              address={address}
              isConnected={isConnected}
            />
          )}

          {/* Chart - Always directly below Token Info */}
          <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1] h-fit">
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

        {/* Right Column: Trading Actions + Other Info (desktop only) */}
        {!isMiniAppView && (
          <div className="space-y-4">
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
            lpType={token.type === "v2aero" ? "aero" : "uniswap"}
            onViewAll={() => setIsStakerLeaderboardOpen(true)}
            onStakingChange={handleStakingChange}
            tokenPrice={token.price}
            userStakedBalance={userStakedBalance}
          />

          {/* Claim Fees Button */}
          <ClaimFeesButton tokenAddress={token.contract_address} />
          </div>
        )}

        {/* Staker Leaderboard for Mini-App (at the bottom) */}
        {isMiniAppView && (
          <div className="space-y-4">
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
              isMiniApp={isMiniAppView}
              farcasterAddress={address}
              farcasterIsConnected={isConnected}
              tokenPrice={token.price}
              userStakedBalance={userStakedBalance}
            />

            {/* Claim Fees Button */}
            <ClaimFeesButton tokenAddress={token.contract_address} />
          </div>
        )}
      </div>
      <div className="fixed inset-0 -z-50">
        <HeroAnimationMini />
      </div>

      {/* Staker Leaderboard Modal */}
      <StakerLeaderboard
        stakingPoolAddress={token.staking_pool}
        tokenAddress={token.contract_address}
        tokenSymbol={token.symbol}
        isOpen={isStakerLeaderboardOpen}
        onClose={() => setIsStakerLeaderboardOpen(false)}
      />
    </div>
  );
}
