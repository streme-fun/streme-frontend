"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, memo } from "react";
import { Token } from "@/src/app/types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import { SPAMMER_BLACKLIST } from "@/src/lib/blacklist";
import { useRewardCounter } from "@/src/hooks/useStreamingNumber";

const TopStreamerComponent = () => {
  const [token, setToken] = useState<Token | null>(null);
  const [initialRewards, setInitialRewards] = useState(0);
  const [totalStakers, setTotalStakers] = useState(0);

  // Use the reward counter hook for animated rewards
  const { currentRewards } = useRewardCounter(
    initialRewards,
    REWARDS_PER_SECOND,
    150 // Balanced between performance and smoothness
  );

  // Helper function to format market cap
  const formatMarketCap = (marketCap: number | undefined) => {
    if (!marketCap || isNaN(marketCap)) return "-";

    if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(1)}M`;
    } else if (marketCap >= 1000) {
      return `$${(marketCap / 1000).toFixed(1)}K`;
    } else {
      return `$${marketCap.toFixed(0)}`;
    }
  };

  useEffect(() => {
    // Fetch tokens and randomly select one
    async function fetchRandomToken() {
      try {
        const response = await fetch("/api/tokens/trending?type=all");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const trendingData = await response.json();

        // Check if trending data is an array
        if (!Array.isArray(trendingData)) {
          console.error("Trending data is not an array:", trendingData);
          setToken(null);
          return;
        }

        // Transform API response to match Token interface (same as TokenGrid.tsx)
        const tokens: Token[] = trendingData.map((apiToken) => ({
          id: apiToken.id,
          created_at: apiToken.created_at,
          tx_hash: apiToken.tx_hash,
          contract_address: apiToken.contract_address,
          requestor_fid: apiToken.requestor_fid,
          name: apiToken.name,
          symbol: apiToken.symbol,
          img_url: apiToken.img_url,
          pool_address: apiToken.pool_address,
          cast_hash: apiToken.cast_hash,
          type: apiToken.type,
          pair: apiToken.pair,
          chain_id: apiToken.chain_id,
          metadata: apiToken.metadata,
          profileImage: null,
          pool_id: apiToken.pool_address,
          staking_pool: apiToken.staking_pool,
          staking_address: apiToken.staking_address,
          pfp_url: apiToken.pfp_url,
          username: apiToken.username,
          timestamp: apiToken.timestamp,
          price: apiToken.marketData?.price,
          marketCap: apiToken.marketData?.marketCap,
          volume24h: apiToken.marketData?.volume24h,
          change1h: apiToken.marketData?.priceChange1h,
          change24h: apiToken.marketData?.priceChange24h,
          creator: {
            name: apiToken.username,
            score: 0,
            recasts: 0,
            likes: 0,
            profileImage: apiToken.pfp_url,
          },
        }));

        // Filter out blacklisted tokens and tokens with $ in name/symbol
        const filteredTokens = tokens.filter((token) => {
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

        // Randomly select a token from the filtered list
        if (filteredTokens.length === 0) {
          setToken(null);
          return;
        }
        const randomToken =
          filteredTokens[Math.floor(Math.random() * filteredTokens.length)];

        // Enrich the selected token with rewards and stakers (same as TokenGrid enrichTokenBatch)
        const { totalStreamed, totalStakers: stakersCount } =
          await calculateRewards(
            randomToken.created_at,
            randomToken.contract_address,
            randomToken.staking_pool
          );

        // Set the enriched token with rewards and stakers
        setToken({
          ...randomToken,
          rewards: totalStreamed,
          totalStakers: stakersCount,
        } as Token & { rewards: number; totalStakers: number });

        setInitialRewards(totalStreamed);
        setTotalStakers(stakersCount);
      } catch (error) {
        console.error("Error fetching random token:", error);
      }
    }

    fetchRandomToken();
  }, []);

  if (!token) return null;

  return (
    <div className="hidden md:block w-full max-w-[1200px] mx-auto mb-8">
      <div className="text-center mb-4">
        <h2 className="text-3xl font-bold tracking-tight">
          🚀 TRENDING STREMER
        </h2>
      </div>

      <div className="max-w-md mx-auto">
        <Link href={`/token/${token.contract_address}`} className="block group">
          <div
            className="card card-side bg-base-100 border-1 border-base-300 rounded-md 
            hover:bg-base-200/50 transition-all duration-300 ease-out
            hover:shadow-lg hover:-translate-y-1 group-hover:border-primary/20"
          >
            {token.img_url ? (
              <figure className="w-[120px] h-[120px] relative overflow-hidden">
                <Image
                  src={token.img_url}
                  alt={token.name}
                  fill
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
              <div className="flex">
                <div className="flex items-start justify-between w-full">
                  <div className="flex flex-col gap-2">
                    <h2 className="card-title text-sm group-hover:text-primary transition-colors duration-300">
                      {token.name}
                    </h2>

                    <div className="flex items-center gap-2">
                      <div className="avatar transition-transform duration-300 group-hover:scale-110">
                        <div className="rounded-full w-4 h-4">
                          <Image
                            src={
                              token.creator?.profileImage ??
                              `/avatars/streme.png`
                            }
                            alt={token.creator?.name ?? "Anon"}
                            width={16}
                            height={16}
                          />
                        </div>
                      </div>
                      <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                        {token.creator?.name ?? "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <div className="text-right text-xs uppercase tracking-wider opacity-50 group-hover:opacity-70 transition-opacity duration-300">
                      MCAP
                    </div>
                    <div className="font-mono text-sm font-bold group-hover:text-primary transition-colors duration-300">
                      {formatMarketCap(token.marketCap)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-actions justify-end mt-auto">
                <div className="w-full px-1">
                  <div className="text-[11px] uppercase tracking-wider opacity-50 group-hover:opacity-70 transition-opacity duration-300">
                    Rewards ({totalStakers}{" "}
                    {totalStakers === 1 ? "staker" : "stakers"})
                  </div>
                  <div className="font-mono text-base font-bold group-hover:text-primary transition-colors duration-300">
                    {currentRewards.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export const TopStreamer = memo(TopStreamerComponent);

TopStreamer.displayName = "TopStreamer";
