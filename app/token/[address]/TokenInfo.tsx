"use client";

import Image from "next/image";
import { Token } from "@/app/types/token";
import FarcasterIcon from "@/public/farcaster.svg";
import { useState, useEffect } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";

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

export function TokenInfo({ token }: { token: Token }) {
  const [rewards, setRewards] = useState<number>(0);
  const [totalStakers, setTotalStakers] = useState<number>(0);

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

  return (
    <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1] space-y-6">
      {/* Token Header */}
      <div className="flex items-center gap-4">
        {token.img_url ? (
          <div className="relative w-16 h-16">
            <Image
              src={token.img_url}
              alt={token.name}
              fill
              className="object-cover rounded-md"
            />
          </div>
        ) : (
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-2xl font-mono">
            {token.symbol?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{token.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base opacity-60">${token.symbol}</span>
          </div>
        </div>
        {token.creator && (
          <div className="flex items-center gap-2">
            <div className="avatar">
              <div className="w-6 h-6 rounded-full">
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
            <a
              href={`https://warpcast.com/${token.creator.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base opacity-60 hover:opacity-100 hover:underline"
            >
              {token.creator.name}
            </a>
            {token.cast_hash && (
              <a
                href={`https://warpcast.com/${token.creator.name}/${shortenHash(
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
      </div>

      {/* Price Row */}
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="text-sm opacity-60 mb-1">Price</div>
          <div className="font-mono text-2xl font-bold">
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
          <div className="text-sm opacity-60 mb-1">Volume 24h</div>
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
          <div className="text-sm opacity-60 mb-1">
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
    </div>
  );
}
