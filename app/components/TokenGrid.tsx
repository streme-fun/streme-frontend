"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import FarcasterIcon from "@/public/farcaster.svg";
import { SearchBar } from "./SearchBar";
import { SortMenu } from "./SortMenu";
import { Token } from "../types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";

interface TokenGridProps {
  tokens: Token[];
}

const TokenCardComponent = ({ token }: { token: Token }) => {
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

  // Get the real market change from token data
  const marketChange = token.change24h ?? token.marketCapChange ?? 0;
  const isPositive = marketChange >= 0;

  // Helper function to shorten hash
  const shortenHash = (hash: string | undefined) => {
    if (!hash) return "";
    return hash.slice(0, 10);
  };

  const handleFarcasterClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      `https://warpcast.com/${token.creator?.name}/${shortenHash(
        token.cast_hash
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <Link href={`/token/${token.contract_address}`} className="block group">
      <div
        className="card card-side bg-base-100 rounded-none border-3 border-base-900 
        hover:bg-black/[.02] dark:hover:bg-white/[.02] transition-all duration-300 ease-out
        hover:shadow-lg hover:-translate-y-1 group-hover:border-primary/20"
      >
        {token.img_url ? (
          <figure className="w-[120px] h-[120px] relative overflow-hidden">
            <Image
              src={token.img_url}
              alt={token.name}
              fill
              sizes="120px"
              className="object-cover transition-transform duration-300 group-hover:scale-110"
            />
          </figure>
        ) : (
          <div
            className="w-[120px] h-[120px] bg-primary flex items-center justify-center 
            text-primary-content font-mono font-bold text-xl
            transition-colors duration-300 group-hover:bg-primary-focus"
          >
            ${token.symbol}
          </div>
        )}
        <div className="card-body p-2 gap-2">
          <div>
            <h2 className="card-title text-sm group-hover:text-primary transition-colors duration-300">
              {token.name}
            </h2>
            <div className="flex items-center justify-between">
              <div
                className={`transition-all duration-300 ${
                  isPositive
                    ? "text-green-500 group-hover:text-green-400"
                    : "text-red-500 group-hover:text-red-400"
                } gap-1 rounded-none text-xs`}
              >
                {isPositive ? "+" : ""}
                {marketChange.toFixed(2)}%
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <div className="avatar transition-transform duration-300 group-hover:scale-110">
                <div className="rounded-full w-4 h-4">
                  <Image
                    src={
                      token.creator?.profileImage ??
                      `/avatars/${token.creator?.name ?? "default"}.avif`
                    }
                    alt={token.creator?.name ?? "Unknown Creator"}
                    width={16}
                    height={16}
                    sizes="16px"
                  />
                </div>
              </div>
              <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                {token.creator?.name ?? "Unknown"}
                {token.cast_hash && token.creator?.name && (
                  <button
                    onClick={handleFarcasterClick}
                    className="hover:text-primary inline-flex items-center ml-auto"
                    title={shortenHash(token.cast_hash)}
                  >
                    <Image
                      src={FarcasterIcon}
                      alt={`View on Farcaster: ${shortenHash(token.cast_hash)}`}
                      width={12}
                      height={12}
                      className="opacity-80 group-hover:opacity-100"
                    />
                  </button>
                )}
              </span>
            </div>
          </div>

          <div className="card-actions justify-end mt-auto">
            <div className="w-full flex justify-between flex-col">
              <div className="text-[11px] uppercase tracking-wider opacity-50 group-hover:opacity-70 transition-opacity duration-300">
                Rewards ({totalStakers}{" "}
                {totalStakers === 1 ? "staker" : "stakers"})
              </div>
              <div className="font-mono text-base font-bold group-hover:text-primary transition-colors duration-300">
                {rewards.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export function TokenGrid({ tokens: initialTokens }: TokenGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tokens, setTokens] = useState(initialTokens);

  // Add polling effect
  useEffect(() => {
    const pollTokens = async () => {
      try {
        const response = await fetch("/api/tokens");
        const data = await response.json();
        if (data.data) {
          setTokens(data.data);
        }
      } catch (error) {
        console.error("Error polling tokens:", error);
      }
    };

    // Poll every 10 seconds
    const interval = setInterval(pollTokens, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredTokens = tokens.filter((token) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (token.name.toLowerCase().includes(searchLower) ||
        token.symbol.toLowerCase().includes(searchLower) ||
        token.creator?.name?.toLowerCase().includes(searchLower)) ??
      false
    );
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <SortMenu />
        <div className="flex-1">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTokens.map((token) => (
          <TokenCardComponent key={token.contract_address} token={token} />
        ))}
      </div>
      {filteredTokens.length === 0 ? (
        <div className="text-center py-12 opacity-60">
          No tokens found matching &quot;{searchQuery}&quot;
        </div>
      ) : null}
    </div>
  );
}
