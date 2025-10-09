"use client";

import Image from "next/image";
import { Token } from "@/src/app/types/token";
import FarcasterIcon from "@/public/farcaster.svg";
import { useState, useEffect } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import DexscreenerIcon from "@/public/dexscreener.webp";
import InterfaceIcon from "@/public/interface.png";
import { useRewardCounter } from "@/src/hooks/useStreamingNumber";
import { useNavigation } from "@/src/hooks/useNavigation";
import { ExternalLink } from "@/src/components/ui/ExternalLink";

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
  return hash.slice(0, 10);
};

interface TokenInfoProps {
  token: Token;
  onShare?: () => Promise<void>;
  isMiniAppView?: boolean;
}

export function TokenInfo({ token, onShare, isMiniAppView }: TokenInfoProps) {
  const [initialRewards, setInitialRewards] = useState<number>(0);
  const [totalStakers, setTotalStakers] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  // Use the reward counter hook for animated rewards
  const { currentRewards } = useRewardCounter(
    initialRewards,
    REWARDS_PER_SECOND,
    150 // Balanced between performance and smoothness
  );

  useEffect(() => {
    calculateRewards(
      token.created_at,
      token.contract_address,
      token.staking_pool
    ).then(({ totalStreamed, totalStakers: stakers }) => {
      setInitialRewards(totalStreamed);
      setTotalStakers(stakers);
    });
  }, [token.created_at, token.contract_address, token.staking_pool]);

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

  const { openExternalUrl } = useNavigation();

  const handleDexscreenerLink = async () => {
    const dexscreenerUrl = `https://dexscreener.com/base/${token.contract_address}`;
    await openExternalUrl(dexscreenerUrl);
  };

  const handleInterfaceLink = async () => {
    const interfaceUrl = `https://app.interface.social/token/8453/${token.contract_address}`;
    await openExternalUrl(interfaceUrl);
  };

  return (
    <div
      className={`space-y-3 card bg-base-100 border border-base-300 p-4 relative z-10 ${
        isMiniAppView ? "mt-0" : "mt-16 md:mt-0"
      }`}
    >
      {/* Share Dropdown - Top Right Corner */}
      {onShare && (
        <div className="dropdown dropdown-end absolute -top-2 -right-2 z-20">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-outline btn-sm border-primary/10 hover:bg-primary/10 bg-base-100"
            title="Share options"
          >
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
            Share
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow border border-base-300"
          >
            <li>
              <button onClick={onShare} className="flex items-center gap-2">
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
            </li>
            <li>
              <button
                onClick={handleShareLink}
                className={`flex items-center gap-2 ${
                  shareSuccess ? "text-success" : ""
                }`}
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
                {shareSuccess ? "Copied!" : "Copy Link"}
              </button>
            </li>
          </ul>
        </div>
      )}
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
            <span className="text-sm opacity-60">
              $
              {token.symbol?.startsWith("$")
                ? token.symbol.substring(1)
                : token.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Creator Information */}
      <div className="flex items-center gap-2 ml-1">
        {token.creator?.name?.trim() ? (
          <>
            <ExternalLink
              href={`https://farcaster.xyz/${token.creator.name}`}
              className="text-base opacity-60 hover:opacity-100 hover:underline flex gap-2 items-center"
            >
              <div className="avatar">
                <div className="w-4 h-4 rounded-full">
                  <Image
                    src={
                      token.creator.profileImage?.trim()
                        ? token.creator.profileImage
                        : token.img_url || `/avatars/${token.creator.name}.avif`
                    }
                    alt={token.creator.name}
                    width={24}
                    height={24}
                  />
                </div>
              </div>
              {token.creator.name}
            </ExternalLink>
            {token.cast_hash && (
              <ExternalLink
                href={`https://farcaster.xyz/${
                  token.creator.name
                }/${shortenHash(token.cast_hash)}`}
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
              </ExternalLink>
            )}
          </>
        ) : (
          <div className="text-base opacity-60 flex gap-2 items-center">
            <div className="avatar">
              <div className="w-4 h-4 rounded-full">
                <Image
                  src={token.img_url || `/avatars/streme.png`}
                  alt="Creator"
                  width={24}
                  height={24}
                />
              </div>
            </div>
            <span className="text-sm">
              {`${token.contract_address.slice(
                0,
                6
              )}...${token.contract_address.slice(-4)}`}
            </span>
          </div>
        )}
      </div>

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
            {currentRewards.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* Staking Configuration (v2 tokens) */}
      {token.staking && (
        <div className="border-t border-base-300 pt-3 space-y-2">
          <div className="text-sm opacity-60 font-semibold mb-2">
            Staking Configuration ({token.type === "v2" ? "v2" : "v1"})
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="opacity-60">Lock Duration</div>
              <div className="font-mono">
                {token.staking.lockDuration >= 86400
                  ? `${(token.staking.lockDuration / 86400).toFixed(0)} days`
                  : `${(token.staking.lockDuration / 3600).toFixed(0)} hours`}
              </div>
            </div>
            <div>
              <div className="opacity-60">Flow Duration</div>
              <div className="font-mono">
                {token.staking.flowDuration >= 86400
                  ? `${(token.staking.flowDuration / 86400).toFixed(0)} days`
                  : `${(token.staking.flowDuration / 3600).toFixed(0)} hours`}
              </div>
            </div>
            <div>
              <div className="opacity-60">Supply</div>
              <div className="font-mono">
                {token.staking.supply.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="opacity-60">Version</div>
              <div className="font-mono">
                {token.type === "v2" ? "v2" : "v1"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version badge for tokens without staking config */}
      {!token.staking && token.type && (
        <div className="border-t border-base-300 pt-3">
          <div className="text-sm">
            <span className="opacity-60">Version: </span>
            <span className="font-mono">
              {token.type === "v2" ? "v2" : "v1"}
            </span>
          </div>
        </div>
      )}

      {/* Website Link for BUTTHOLE token */}
      {token.contract_address.toLowerCase() ===
        "0x1c4f69f14cf754333c302246d25a48a13224118a" && (
        <div className="flex mt-2 -ml-1 gap-2 flex-wrap">
          <button
            onClick={() => openExternalUrl("https://butthole.stream")}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
            title="Visit official website"
          >
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
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9"
              />
            </svg>
            Website
          </button>

          <button
            onClick={() => openExternalUrl("https://x.com/BUTTHOLE_HQ")}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
            title="Follow on X (Twitter)"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              role="img"
              viewBox="0 0 24 24"
              className="w-2 h-2"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path>
            </svg>
            @BUTTHOLE_HQ
          </button>

          <button
            onClick={() => openExternalUrl("https://t.me/buttholehq")}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
            title="Join Telegram"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 32 32"
            >
              <path d="M16 0.5c-8.563 0-15.5 6.938-15.5 15.5s6.938 15.5 15.5 15.5c8.563 0 15.5-6.938 15.5-15.5s-6.938-15.5-15.5-15.5zM23.613 11.119l-2.544 11.988c-0.188 0.85-0.694 1.056-1.4 0.656l-3.875-2.856-1.869 1.8c-0.206 0.206-0.381 0.381-0.781 0.381l0.275-3.944 7.181-6.488c0.313-0.275-0.069-0.431-0.482-0.156l-8.875 5.587-3.825-1.194c-0.831-0.262-0.85-0.831 0.175-1.231l14.944-5.763c0.694-0.25 1.3 0.169 1.075 1.219z" />
            </svg>
            Telegram
          </button>
        </div>
      )}

      {/* External Links */}
      <div className="flex mt-2 -ml-1 gap-2 flex-wrap">
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
          Dexscreener
        </button>

        <button
          onClick={handleInterfaceLink}
          className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
          title="View on Interface"
        >
          <Image src={InterfaceIcon} alt="Interface" width={16} height={16} />
          Interface
        </button>
      </div>
    </div>
  );
}
