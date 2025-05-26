"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import FarcasterIcon from "@/public/farcaster.svg";
// import { SearchBar } from "./SearchBar";
// import { SortMenu } from "./SortMenu";
import { Token } from "../app/types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import { SPAMMER_BLACKLIST } from "@/src/lib/blacklist";

interface TokenGridProps {
  tokens: Token[];
  searchQuery: string;
  sortBy: SortOption;
}

export type SortOption = "stakers" | "newest" | "oldest" | "trending";

// Interface for the streme.fun API response
interface StremeTokenResponse {
  id: number;
  created_at: string;
  tx_hash: string;
  contract_address: string;
  requestor_fid: number;
  deployer: string;
  name: string;
  symbol: string;
  img_url: string;
  pool_address: string;
  cast_hash: string;
  type: string;
  pair: string;
  chain_id: number;
  metadata: Record<string, unknown>;
  tokenFactory: string;
  postDeployHook: string;
  liquidityFactory: string;
  postLpHook: string;
  poolConfig: {
    tick: number;
    pairedToken: string;
    devBuyFee: number;
  };
  timestamp: { _seconds: number; _nanoseconds: number };
  staking_pool: string;
  staking_address: string;
  pfp_url: string;
  username: string;
  channel?: string;
  marketData?: {
    marketCap: number;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange5m: number;
    volume24h: number;
    lastUpdated: { _seconds: number; _nanoseconds: number };
  };
  lastTraded?: { _seconds: number; _nanoseconds: number };
}

// Function to fetch trending tokens from the streme.fun API
const fetchTrendingTokens = async (): Promise<Token[]> => {
  try {
    const response = await fetch("/api/tokens/trending");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const trendingData: StremeTokenResponse[] = await response.json();

    // Transform API response to match Token interface
    return trendingData.map((apiToken) => ({
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
      profileImage: null, // Not in API response
      pool_id: apiToken.pool_address, // Use pool_address as pool_id
      staking_pool: apiToken.staking_pool,
      staking_address: apiToken.staking_address,
      pfp_url: apiToken.pfp_url,
      username: apiToken.username,
      timestamp: apiToken.timestamp,
      // Use market data directly from streme.fun API
      marketData: apiToken.marketData,
      price: apiToken.marketData?.price,
      marketCap: apiToken.marketData?.marketCap,
      volume24h: apiToken.marketData?.volume24h,
      change1h: apiToken.marketData?.priceChange1h,
      change24h: apiToken.marketData?.priceChange24h,
      creator: {
        name: apiToken.username,
        score: 0, // Not available in API
        recasts: 0, // Not available in API
        likes: 0, // Not available in API
        profileImage: apiToken.pfp_url,
      },
    }));
  } catch (error) {
    console.error("Error fetching trending tokens:", error);
    return [];
  }
};

const TokenCardComponent = ({
  token,
}: {
  token: Token & { rewards: number; totalStakers: number };
}) => {
  const [rewards, setRewards] = useState<number>(token.rewards);
  const [totalStakers, setTotalStakers] = useState<number>(token.totalStakers);

  useEffect(() => {
    if (!token.creator) {
      console.log("Missing creator for token:", {
        name: token.name,
        symbol: token.symbol,
        address: token.contract_address,
      });
    } else if (!token.creator.name) {
      console.log("Missing creator name for token:", {
        name: token.name,
        symbol: token.symbol,
        address: token.contract_address,
        creator: token.creator,
      });
    }
  }, [token]);

  useEffect(() => {
    // Initialize state from props
    setRewards(token.rewards);
    setTotalStakers(token.totalStakers);
  }, [token.rewards, token.totalStakers]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + REWARDS_PER_SECOND / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Helper function to shorten hash
  const shortenHash = (hash: string | undefined) => {
    if (!hash) return "";
    return hash.slice(0, 10);
  };

  const handleFarcasterClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      `https://farcaster.xyz/${token.creator?.name}/${shortenHash(
        token.cast_hash
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // Add the same helper function
  // const formatPrice = (price: number | undefined) => {
  //   if (!price || isNaN(price)) return "-";

  //   if (price < 0.000001) {
  //     const scientificStr = price.toExponential(2);
  //     const [base, exponent] = scientificStr.split("e");
  //     return (
  //       <span className="whitespace-nowrap">
  //         ${base}
  //         <span className="text-xs opacity-60">×10{exponent}</span>
  //       </span>
  //     );
  //   }

  //   return `$${price.toLocaleString(undefined, {
  //     minimumFractionDigits: 6,
  //     maximumFractionDigits: 6,
  //   })}`;
  // };

  return (
    <Link href={`/token/${token.contract_address}`} className="block group">
      <div
        className="card card-side bg-base-100 rounded-md border-1 border-gray-300 
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
              unoptimized={
                token.img_url.includes(".gif") ||
                token.img_url.includes("imagedelivery.net")
              }
            />
          </figure>
        ) : (
          <div
            className="w-[120px] h-[120px] bg-primary flex items-center justify-center 
            text-primary-content font-mono font-bold text-xl overflow-hidden px-2
            transition-colors duration-300 group-hover:bg-primary-focus"
            title={token.symbol}
          >
            ${token.symbol.slice(0, 10)}
            {token.symbol.length > 10 && "..."}
          </div>
        )}
        <div className="card-body p-2 gap-2">
          <div className="flex">
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col gap-2">
                <h2
                  className="card-title text-sm group-hover:text-primary transition-colors duration-300 truncate max-w-[200px] overflow-hidden"
                  title={token.name}
                >
                  {token.name}
                </h2>
                <div className="flex items-center gap-2">
                  <div className="avatar transition-transform duration-300 group-hover:scale-110">
                    <div className="rounded-full w-4 h-4">
                      <Image
                        src={
                          token.creator?.profileImage ??
                          `/avatars/${token.creator?.name ?? "streme"}.png`
                        }
                        alt={token.creator?.name ?? "Anon"}
                        width={16}
                        height={16}
                        sizes="16px"
                        unoptimized={
                          (token.creator?.profileImage?.includes(".gif") ||
                            token.creator?.profileImage?.includes(
                              "imagedelivery.net"
                            )) ??
                          false
                        }
                      />
                    </div>
                  </div>
                  <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2 max-w-[120px]">
                    <span
                      className="truncate"
                      title={token.creator?.name ?? "Anon"}
                    >
                      {token.creator?.name ?? "Anon"}
                    </span>
                    {token.cast_hash && token.creator?.name && (
                      <button
                        onClick={handleFarcasterClick}
                        className="hover:text-primary inline-flex items-center ml-auto"
                        title={shortenHash(token.cast_hash)}
                      >
                        <Image
                          src={FarcasterIcon}
                          alt={`View on Farcaster: ${shortenHash(
                            token.cast_hash
                          )}`}
                          width={12}
                          height={12}
                          className="opacity-80 group-hover:opacity-100"
                        />
                      </button>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end text-right">
                <div className="text-right text-xs uppercase tracking-wider opacity-50 group-hover:opacity-70 transition-opacity duration-300">
                  MKT CAP
                </div>
                <div className="font-mono text-sm font-bold group-hover:text-primary transition-colors duration-300">
                  {token.marketCap
                    ? `$${
                        token.marketCap >= 1000000
                          ? (token.marketCap / 1000000).toFixed(1) + "M"
                          : token.marketCap >= 1000
                          ? (token.marketCap / 1000).toFixed(1) + "K"
                          : token.marketCap.toFixed(0)
                      }`
                    : "-"}
                </div>
              </div>
            </div>
            {/* Comment out market change display
            <div className="flex items-center justify-between">
              <div
                className={`transition-all duration-300 ${
                  marketChange === undefined
                    ? ""
                    : marketChange >= 0
                    ? "text-green-500 group-hover:text-green-400"
                    : "text-red-500 group-hover:text-red-400"
                } gap-1 rounded-none text-xs`}
              >
                {changeDisplay}
              </div>
            </div>
            */}
          </div>

          <div className="card-actions justify-end mt-auto">
            <div className="w-full px-1">
              <div className="text-[11px] uppercase tracking-wider opacity-50 group-hover:opacity-70 transition-opacity duration-300">
                Rewards ({totalStakers}{" "}
                {totalStakers === 1 ? "staker" : "stakers"})
              </div>
              <div className="font-mono text-sm font-bold group-hover:text-primary transition-colors duration-300">
                {rewards.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                  ${token.symbol}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export function TokenGrid({ tokens, searchQuery, sortBy }: TokenGridProps) {
  const [displayedTokens, setDisplayedTokens] = useState<
    Array<Token & { rewards: number; totalStakers: number }>
  >([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [stakersSortedAllTokensCache, setStakersSortedAllTokensCache] =
    useState<Array<Token & { rewards: number; totalStakers: number }>>([]);
  const [isFetchingTrending, setIsFetchingTrending] = useState(false);
  const trendingTokensRef = useRef<Token[]>([]);
  const TOKENS_PER_PAGE = 36;

  // Fetch trending tokens when sortBy is "trending"
  useEffect(() => {
    if (sortBy === "trending") {
      setIsFetchingTrending(true);
      const fetchTrending = async () => {
        try {
          const trending = await fetchTrendingTokens();
          trendingTokensRef.current = trending;
        } finally {
          setIsFetchingTrending(false);
        }
      };
      fetchTrending();
    } else {
      // Clear trending tokens when not in trending mode
      trendingTokensRef.current = [];
      setIsFetchingTrending(false);
    }
  }, [sortBy]);

  useEffect(() => {
    setCurrentPage(1);
    setDisplayedTokens([]);
    setTotalItemsCount(0);
    setStakersSortedAllTokensCache([]);
  }, [tokens, sortBy, searchQuery]); // Added searchQuery to reset pagination when search changes

  // Helper to enrich a batch of tokens with rewards and stakers data
  const enrichTokenBatch = async (batch: Token[]) => {
    return Promise.all(
      batch.map(async (token) => {
        // If token already has rewards/stakers (e.g. from stakersSortedAllTokensCache), use them
        if ("rewards" in token && "totalStakers" in token) {
          return token as Token & { rewards: number; totalStakers: number };
        }
        const { totalStreamed, totalStakers } = await calculateRewards(
          token.created_at,
          token.contract_address,
          token.staking_pool
        );
        return {
          ...token,
          rewards: totalStreamed,
          totalStakers,
        };
      })
    );
  };

  // Helper to sort tokens by date
  const sortTokensByDate = (
    tokensToSort: Array<Token & { rewards?: number; totalStakers?: number }>, // Allow optional for initial sort
    sortOrder: "newest" | "oldest"
  ) => {
    return [...tokensToSort].sort((a, b) => {
      if (sortOrder === "newest") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else {
        // oldest
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
    });
  };

  // Main data processing effect: handles filtering, searching, sorting, and pagination
  useEffect(() => {
    // Don't process if we're still fetching trending tokens
    if (sortBy === "trending" && isFetchingTrending) {
      return;
    }

    const fetchDataAndProcess = async () => {
      // Determine which tokens to use based on sortBy
      const sourceTokens =
        sortBy === "trending" ? trendingTokensRef.current : tokens;

      if (!sourceTokens || sourceTokens.length === 0) {
        // Only update state if it's actually different to prevent unnecessary re-renders
        if (displayedTokens.length > 0) setDisplayedTokens([]);
        if (totalItemsCount > 0) setTotalItemsCount(0);
        if (stakersSortedAllTokensCache.length > 0)
          setStakersSortedAllTokensCache([]);
        setIsLoadingMore(false);
        return;
      }

      setIsLoadingMore(true);

      const uniqueIncomingTokens = Array.from(
        new Map(
          sourceTokens.map((token) => [token.contract_address, token])
        ).values()
      );
      const baseFilteredTokens = uniqueIncomingTokens.filter(
        (token) =>
          !token.creator?.name ||
          !SPAMMER_BLACKLIST.includes(token.creator.name.toLowerCase())
      );

      // Use searchQuery prop for filtering
      let searchedTokensResult: Token[];
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase().trim();
        searchedTokensResult = baseFilteredTokens.filter((token) => {
          const nameMatch =
            token.name &&
            typeof token.name === "string" &&
            token.name.toLowerCase().includes(searchLower);
          const symbolMatch =
            token.symbol &&
            typeof token.symbol === "string" &&
            token.symbol.toLowerCase().includes(searchLower);
          const creatorNameMatch =
            token.creator &&
            token.creator.name &&
            typeof token.creator.name === "string" &&
            token.creator.name.toLowerCase().includes(searchLower);
          return nameMatch || symbolMatch || creatorNameMatch;
        });
      } else {
        searchedTokensResult = baseFilteredTokens;
      }

      // Use sortBy prop for sorting
      let sortedTokens: Array<
        Token & { rewards: number; totalStakers: number }
      >;
      if (sortBy === "stakers") {
        // If searching, we must enrich and sort the searched subset.
        // If not searching, we can use the cache or build it.
        if (searchQuery.trim()) {
          const enrichedSearched = await enrichTokenBatch(searchedTokensResult);
          sortedTokens = enrichedSearched.sort(
            (a, b) => b.totalStakers - a.totalStakers
          );
        } else {
          // Not searching, use cache or build it
          if (stakersSortedAllTokensCache.length > 0 && currentPage > 1) {
            // Use cache if available and not on the first page (first page might rebuild cache)
            sortedTokens = stakersSortedAllTokensCache;
          } else {
            // Build/rebuild cache for all non-searched tokens
            const enrichedAll = await enrichTokenBatch(searchedTokensResult); // searchedTokensResult is baseFilteredTokens here
            sortedTokens = enrichedAll.sort(
              (a, b) => b.totalStakers - a.totalStakers
            );
            setStakersSortedAllTokensCache(sortedTokens);
          }
        }
      } else if (sortBy === "trending") {
        // For trending, tokens are already sorted by the API, just enrich them
        const enrichedTrending = await enrichTokenBatch(searchedTokensResult);
        sortedTokens = enrichedTrending;
        // Clear staker cache if we switch to trending
        if (stakersSortedAllTokensCache.length > 0)
          setStakersSortedAllTokensCache([]);
      } else {
        // For "newest" or "oldest" sort: Sort by date. Enrichment happens per page.
        // We cast searchedTokensResult here as its enrichment status is not yet guaranteed.
        sortedTokens = sortTokensByDate(
          searchedTokensResult as Array<
            Token & { rewards?: number; totalStakers?: number }
          >,
          sortBy as "newest" | "oldest"
        ) as Array<Token & { rewards: number; totalStakers: number }>; // Assume enrichment will happen
        // Clear staker cache if we switch away from staker sort
        if (stakersSortedAllTokensCache.length > 0)
          setStakersSortedAllTokensCache([]);
      }

      setTotalItemsCount(sortedTokens.length);

      const startIndex = (currentPage - 1) * TOKENS_PER_PAGE;
      const endIndex = currentPage * TOKENS_PER_PAGE;
      const pageBatchUnenriched = sortedTokens.slice(startIndex, endIndex);

      let finalPageBatch: Array<
        Token & { rewards: number; totalStakers: number }
      >;
      // Use sortBy prop for logic
      if (
        (sortBy !== "stakers" && sortBy !== "trending") ||
        searchQuery.trim()
      ) {
        finalPageBatch = await enrichTokenBatch(pageBatchUnenriched);
      } else {
        // If staker sort or trending and no search, tokens are already enriched from sortedTokens (or cache)
        finalPageBatch = pageBatchUnenriched as Array<
          Token & { rewards: number; totalStakers: number }
        >;
      }

      if (currentPage === 1) {
        setDisplayedTokens(finalPageBatch);
      } else {
        if (finalPageBatch.length > 0) {
          // Deduplicate before appending, ensuring keys are unique for React
          setDisplayedTokens((prev) => {
            const existingKeys = new Set(prev.map((t) => t.contract_address));
            const newUniqueTokens = finalPageBatch.filter(
              (t) => !existingKeys.has(t.contract_address)
            );
            return [...prev, ...newUniqueTokens];
          });
        }
      }
      setIsLoadingMore(false);
    };

    fetchDataAndProcess();
  }, [tokens, currentPage, sortBy, searchQuery, isFetchingTrending]); // Only depend on props and fetching state to prevent refresh loops

  // Handle loading more tokens
  const handleLoadMore = () => {
    if (!isLoadingMore && displayedTokens.length < totalItemsCount) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  // Calculate if there are more tokens to load
  const hasMoreTokens =
    displayedTokens.length < totalItemsCount && displayedTokens.length > 0;

  return (
    <div className="mt-2 pb-24">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedTokens.map((token) => (
          <TokenCardComponent key={token.contract_address} token={token} />
        ))}
      </div>
      {displayedTokens.length === 0 &&
        totalItemsCount === 0 &&
        searchQuery.trim() !== "" && (
          <div className="text-center py-12 opacity-60">
            No tokens found matching &quot;{searchQuery.trim()}&quot;
          </div>
        )}
      {displayedTokens.length === 0 &&
        totalItemsCount === 0 &&
        searchQuery.trim() === "" &&
        !isLoadingMore && (
          <div className="text-center py-12 opacity-60">Loading tokens...</div>
        )}
      {isLoadingMore && displayedTokens.length === 0 && (
        <div className="text-center py-12 opacity-60">Loading tokens...</div>
      )}
      {hasMoreTokens && (
        <div className="text-center mt-8">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="btn btn-primary"
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
