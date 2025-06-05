"use client";

import Image from "next/image";
import { Token } from "@/src/app/types/token";
import FarcasterIcon from "@/public/farcaster.svg";
import { useState, useEffect } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import DexscreenerIcon from "@/public/dexscreener.webp";
import { sdk } from "@farcaster/frame-sdk";

const formatPrice = (price: number | undefined) => {
  if (!price || isNaN(price)) return "-";

  if (price < 0.01 && price > 0) {
    const decimalStr = price.toFixed(20).split(".")[1];
    let zeroCount = 0;
    while (decimalStr[zeroCount] === "0") {
      zeroCount++;
    }

    return (
      <span className="whitespace-nowrap">
        $0.0{zeroCount > 0 && <sub>{zeroCount}</sub>}
        {decimalStr.slice(zeroCount, zeroCount + 4)}
      </span>
    );
  }

  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  })}`;
};

const formatCurrency = (value: number | undefined) => {
  if (!value || isNaN(value)) return "-";
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

const shortenHash = (hash: string | undefined) => {
  if (!hash) return "";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

interface TokenInfoProps {
  token: Token;
  onShare?: () => Promise<void>;
  isMiniAppView?: boolean;
}

export function TokenInfo({ token, onShare, isMiniAppView }: TokenInfoProps) {
  const [rewards, setRewards] = useState<number>(0);
  const [totalStakers, setTotalStakers] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  useEffect(() => {
    calculateRewards(
      token.created_at,
      token.contract_address,
      token.staking_pool
    ).then(({ totalStreamed, totalStakers: stakers }) => {
      setRewards(totalStreamed);
      setTotalStakers(stakers);
    });
  }, [token.created_at, token.contract_address, token.staking_pool]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + REWARDS_PER_SECOND / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(token.contract_address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const handleShareLink = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleDexscreenerLink = async () => {
    const dexscreenerUrl = `https://dexscreener.com/base/${token.contract_address}`;

    if (isMiniAppView) {
      try {
        await sdk.actions.openUrl(dexscreenerUrl);
      } catch (err) {
        console.error("Failed to open URL with Mini App SDK:", err);
        // Fallback to regular window.open if SDK fails
        window.open(dexscreenerUrl, "_blank", "noopener,noreferrer");
      }
    } else {
      window.open(dexscreenerUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`space-y-3 card bg-base-100 border-gray-100 border-2 p-4 relative z-10 ${
        isMiniAppView ? "mt-0" : "mt-12 md:mt-0"
      }`}
    >
      {/* Token Header */}
      <div className="flex items-center gap-4 flex-wrap">
        {token.img_url ? (
          <div className="relative w-12 h-12">
            <Image
              src={token.img_url}
              alt={token.name}
              fill
              className="object-cover rounded-md "
            />
          </div>
        ) : (
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-2xl font-mono">
            {token.symbol?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{token.name}</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-60">${token.symbol}</span>
          </div>
        </div>

        {/* Top Right Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAddress}
            className={`btn btn-outline btn-sm transition-all duration-200 ${
              copySuccess
                ? "border-success text-success hover:bg-success/10"
                : "border-primary/10 hover:bg-primary/10"
            }`}
            title={copySuccess ? "Address copied!" : "Copy contract address"}
          >
            {copySuccess ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
            {copySuccess ? "Copied!" : "CA"}
          </button>

          <button
            onClick={handleDexscreenerLink}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
            title="View on Dexscreener"
          >
            <Image
              src={DexscreenerIcon}
              alt="Dexscreener"
              width={16}
              height={16}
            />
          </button>
        </div>
      </div>

      {/* Creator Information */}
      {token.creator && (
        <div className="flex items-center gap-2 ml-1">
          <a
            href={`https://farcaster.xyz/${token.creator.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base opacity-60 hover:opacity-100 hover:underline flex gap-2 items-center"
          >
            <div className="avatar">
              <div className="w-4 h-4 rounded-full">
                <Image
                  src={
                    token.creator.profileImage ??
                    `/avatars/${token.creator.name}.avif`
                  }
                  alt={token.creator.name}
                  width={24}
                  height={24}
                />
              </div>
            </div>
            {token.creator.name}
          </a>
          {token.cast_hash && (
            <a
              href={`https://farcaster.xyz/${token.creator.name}/${shortenHash(
                token.cast_hash
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary inline-flex items-center"
              title="View original cast"
            >
              <Image
                src={FarcasterIcon}
                alt="View on Farcaster"
                width={14}
                height={14}
                className="opacity-60 hover:opacity-100"
              />
            </a>
          )}
        </div>
      )}

      {/* Price Row */}
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="text-sm opacity-60 md:mb-1">Price</div>
          <div className="font-mono text-xl font-bold">
            {formatPrice(token.price)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm opacity-60 mb-1">24h Change</div>
          <div
            className={`font-mono text-lg ${
              token.change24h && token.change24h >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {token.change24h
              ? `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(
                  2
                )}%`
              : "-"}
          </div>
        </div>
      </div>

      {/* Market Stats */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm opacity-60 md:mb-1">24h Volume</div>
          <div className="font-mono text-lg">
            {formatCurrency(token.volume24h)}
          </div>
        </div>
        <div>
          <div className="text-sm opacity-60 mb-1">Market Cap</div>
          <div className="font-mono text-lg">
            {formatCurrency(token.marketCap)}
          </div>
        </div>
      </div>

      {/* Rewards Row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm opacity-60 md:mb-1">
            Total Rewards Distributed ({totalStakers}{" "}
            {totalStakers === 1 ? "staker" : "stakers"})
          </div>
          <div className="font-mono">
            {rewards.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
      {/* Share Button for Desktop and Mini App */}
      {onShare && (
        <div className="flex mt-2 -ml-1 gap-2 flex-wrap">
          <button
            onClick={onShare}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
            >
              <path
                fill="#845FC9"
                d="M18.24.24H5.76A5.76 5.76 0 0 0 0 6v12a5.76 5.76 0 0 0 5.76 5.76h12.48A5.76 5.76 0 0 0 24 18V6A5.76 5.76 0 0 0 18.24.24m.816 17.166v.504a.49.49 0 0 1 .543.48v.568h-5.143v-.569A.49.49 0 0 1 15 17.91v-.504c0-.22.153-.402.358-.458l-.01-4.364c-.158-1.737-1.64-3.098-3.443-3.098s-3.285 1.361-3.443 3.098l-.01 4.358c.228.042.532.208.54.464v.504a.49.49 0 0 1 .543.48v.568H4.392v-.569a.49.49 0 0 1 .543-.479v-.504c0-.253.201-.454.454-.472V9.039h-.49l-.61-2.031H6.93V5.042h9.95v1.966h2.822l-.61 2.03h-.49v7.896c.252.017.453.22.453.472"
              />
            </svg>
            Share on Farcaster
          </button>

          <button
            onClick={handleShareLink}
            className={`btn btn-outline btn-sm border-primary/10 flex items-center gap-2 transition-all duration-200 ${
              shareSuccess
                ? "border-success text-success hover:bg-success/10"
                : "hover:bg-primary/10"
            }`}
            title={shareSuccess ? "Link copied!" : "Copy page link"}
          >
            {shareSuccess ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
            )}
            {shareSuccess ? "Copied!" : "Share Link"}
          </button>
        </div>
      )}
    </div>
  );
}
