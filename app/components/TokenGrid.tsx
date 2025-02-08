"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { Pagination } from "./Pagination";
import { SortMenu } from "./SortMenu";
import { Token } from "../types/token";

interface TokenGridProps {
  tokens: Token[];
}

const TokenCardComponent = ({ token }: { token: Token }) => {
  const [rewards, setRewards] = useState(token.marketCap ?? 0 * 0.01);

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + ((token.marketCap ?? 0) * 0.0001) / 20);
    }, 50);
    return () => clearInterval(interval);
  }, [token.marketCap]);

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
                  (token.marketCapChange ?? 0) >= 0
                    ? "text-green-500 group-hover:text-green-400"
                    : "text-red-500 group-hover:text-red-400"
                } gap-1 rounded-none text-xs`}
              >
                {(token.marketCapChange ?? 0) >= 0 ? "+" : ""}
                {(token.marketCapChange ?? 0).toFixed(2)}%
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
                  />
                </div>
              </div>
              <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                {token.creator?.name ?? "Unknown"}
              </span>
              <div className="flex items-center gap-2 ml-auto text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                <span className="hover:text-primary">
                  🔄 {token.creator?.recasts ?? 0}
                </span>
                <span className="hover:text-primary">
                  ❤️ {token.creator?.likes ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="card-actions justify-end mt-auto">
            <div className="w-full px-1 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider opacity-50 group-hover:opacity-70 transition-opacity duration-300">
                Rewards
              </div>
              <div className="font-mono text-base font-bold group-hover:text-primary transition-colors duration-300">
                $
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

export function TokenGrid({ tokens }: TokenGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
          <TokenCardComponent key={token.id} token={token} />
        ))}
      </div>
      {filteredTokens.length === 0 ? (
        <div className="text-center py-12 opacity-60">
          No tokens found matching &quot;{searchQuery}&quot;
        </div>
      ) : (
        <Pagination />
      )}
    </div>
  );
}
