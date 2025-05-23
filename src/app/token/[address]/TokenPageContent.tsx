"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TokenActions } from "./TokenActions";
import { Token } from "@/src/app/types/token";
import { TokenInfo } from "./TokenInfo";
import { StakedBalance } from "@/src/components/StakedBalance";
import { ClaimFeesButton } from "@/src/components/ClaimFeesButton";
import { publicClient } from "@/src/lib/viemClient";
import { LP_FACTORY_ADDRESS, LP_FACTORY_ABI } from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import sdk from "@farcaster/frame-sdk";
import { HeroAnimationMini } from "@/src/components/HeroAnimationMini";

type Deployment = {
  token: string;
  locker: string;
  positionId: bigint;
};

export function TokenPageContent() {
  const params = useParams();
  const pageAddress = params.address as string;
  const [token, setToken] = useState<Token | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  const {
    isSDKLoaded,
    isMiniAppView,
    address,
    isConnected,
    isOnCorrectNetwork,
  } = useAppFrameLogic();

  useEffect(() => {
    async function fetchToken() {
      try {
        const response = await fetch(
          `/api/tokens/single?address=${pageAddress}`
        );
        const data = await response.json();
        if (data.data) {
          setToken(data.data);
        }
      } catch (error) {
        console.error("Error fetching token:", error);
      } finally {
        setTokenLoading(false);
      }
    }

    fetchToken();
  }, [pageAddress]);

  useEffect(() => {
    if (!address || !token || !isConnected) {
      setIsCreator(false);
      return;
    }

    const checkIsCreator = async () => {
      try {
        const deployments = (await publicClient.readContract({
          address: LP_FACTORY_ADDRESS,
          abi: LP_FACTORY_ABI,
          functionName: "getTokensDeployedByUser",
          args: [address as `0x${string}`],
        })) as Deployment[];

        const isCreatorResult = deployments.some(
          (d) => d.token.toLowerCase() === token.contract_address.toLowerCase()
        );
        setIsCreator(isCreatorResult);
      } catch (error) {
        console.error("Error checking creator status:", error);
        setIsCreator(false);
      }
    };

    checkIsCreator();
  }, [address, token, isConnected]);

  const handleStakingChange = () => {
    const stakedBalanceElement = document.querySelector(
      "[data-staking-balance]"
    );
    if (stakedBalanceElement) {
      stakedBalanceElement.dispatchEvent(new Event("refresh"));
    }
  };

  const handleShare = async () => {
    if (!token) return;

    // Format price for sharing - avoid scientific notation
    const formatPriceForShare = (price: number | undefined) => {
      if (!price || isNaN(price)) return "N/A";

      if (price < 0.01 && price > 0) {
        const decimalStr = price.toFixed(20).split(".")[1];
        let zeroCount = 0;
        while (decimalStr[zeroCount] === "0") {
          zeroCount++;
        }
        return `$0.${"0".repeat(zeroCount)}${decimalStr.slice(
          zeroCount,
          zeroCount + 4
        )}`;
      }

      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })}`;
    };

    // Format 24h change same as in TokenInfo.tsx
    const format24hChange = (change24h: number | undefined) => {
      if (change24h === undefined || change24h === null) return "";
      const sign = change24h >= 0 ? "+" : "";
      return `${sign}${change24h.toFixed(2)}%`;
    };

    const shareUrl = `https://streme.fun/token/${pageAddress}`;
    const change24hText =
      token.change24h !== undefined
        ? `\n24h: ${format24hChange(token.change24h)}`
        : "";

    const castText = `Check out $${
      token.symbol
    } on Streme! 🚀\n\nPrice: ${formatPriceForShare(
      token.price
    )}\nMarket Cap: $${parseFloat(
      token.marketCap?.toString() || "0"
    ).toLocaleString()}${change24hText}\n\n${shareUrl}`;

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

  if (!token) {
    return <div className="text-center py-8">Token not found</div>;
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
    <div className="max-w-[1440px] mx-auto sm:px-6 lg:px-8 lg:mt-20 pt-8 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        <div className="order-1 lg:order-2 lg:col-span-4 space-y-4">
          <TokenInfo
            token={token}
            onShare={handleShare}
            isMiniAppView={isMiniAppView}
          />

          <TokenActions
            token={token}
            onStakingChange={handleStakingChange}
            isMiniAppView={isMiniAppView}
            address={address}
            isConnected={isConnected}
            isOnCorrectNetwork={isOnCorrectNetwork}
          />
          <StakedBalance
            data-staking-balance
            stakingAddress={token.staking_address}
            stakingPool={token.staking_pool}
            symbol={token.symbol}
            tokenAddress={token.contract_address}
            isMiniApp={isMiniAppView}
            farcasterAddress={address}
            farcasterIsConnected={isConnected}
          />
          <ClaimFeesButton
            tokenAddress={token.contract_address}
            creatorAddress={isCreator ? address : undefined}
            isMiniApp={isMiniAppView}
            farcasterAddress={address}
            farcasterIsConnected={isConnected}
          />
        </div>

        <div className="order-2 lg:order-1 lg:col-span-8 card bg-base-100 border border-black/[.1] dark:border-white/[.1] h-fit">
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
    </div>
  );
}
