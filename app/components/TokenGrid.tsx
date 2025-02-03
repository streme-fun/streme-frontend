"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { SearchBar } from "./SearchBar";

type TokenCard = {
  id: string;
  name: string;
  symbol: string;
  marketCap: number;
  marketCapChange: number;
  volume24h: number;
  imageUrl: string;
  creator: {
    name: string;
    score: number;
    recasts: number;
    likes: number;
  };
  createdAt: string;
};

const TokenCardComponent = ({ token }: { token: TokenCard }) => {
  const [rewards, setRewards] = useState(token.marketCap * 0.01);

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + (token.marketCap * 0.0001) / 20);
    }, 50);
    return () => clearInterval(interval);
  }, [token.marketCap]);

  return (
    <Link href={`/token/${token.symbol}`}>
      <div className="card card-side bg-base-100 rounded-none border-3 border-base-900">
        {token.imageUrl ? (
          <figure className="w-[120px] h-[120px] relative">
            <Image
              src={token.imageUrl}
              alt={token.name}
              fill
              className="object-cover"
            />
          </figure>
        ) : (
          <div className="w-[120px] h-[120px] bg-primary flex items-center justify-center text-primary-content font-mono font-bold text-xl">
            ${token.symbol}
          </div>
        )}
        <div className="card-body p-2 gap-2">
          <div>
            <h2 className="card-title text-sm">{token.name}</h2>
            <div className="flex items-center justify-between">
              <div
                className={` ${
                  token.marketCapChange >= 0 ? "text-green-500" : "text-red-500"
                } gap-1 rounded-none text-xs`}
              >
                {token.marketCapChange >= 0 ? "+" : ""}
                {token.marketCapChange.toFixed(2)}%
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <div className="avatar">
                <div className="rounded-full w-4 h-4">
                  <Image
                    src={`/avatars/${token.creator.name}.avif`}
                    alt={token.creator.name}
                    width={16}
                    height={16}
                  />
                </div>
              </div>
              <span className="text-xs opacity-60">{token.creator.name}</span>
              <div className="flex items-center gap-2 ml-auto text-xs opacity-60">
                <span>🔄 {token.creator.recasts}</span>
                <span>❤️ {token.creator.likes}</span>
              </div>
            </div>
          </div>

          <div className="card-actions justify-end mt-auto">
            <div className="w-full  px-1 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider opacity-50">
                Rewards
              </div>
              <div className="font-mono text-base font-bold">
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

const defaultTokens: TokenCard[] = [
  {
    id: "1",
    name: "Based Fwog",
    symbol: "FWOG",
    marketCap: 459510,
    marketCapChange: -1.77,
    volume24h: 12420,
    imageUrl: "/tokens/skimochi.avif",
    creator: {
      name: "zeni",
      score: 79,
      recasts: 17,
      likes: 62,
    },
    createdAt: "2 months ago",
  },
  {
    id: "2",
    name: "PEPE Streamer",
    symbol: "PEPEC",
    marketCap: 214120,
    marketCapChange: 2.24,
    volume24h: 49620,
    imageUrl: "/tokens/streamer.jpeg",
    creator: {
      name: "zeni",
      score: 35,
      recasts: 3,
      likes: 32,
    },
    createdAt: "3 months ago",
  },
  {
    id: "3",
    name: "Autonomous AI Agent",
    symbol: "AUTO",
    marketCap: 57450,
    marketCapChange: 0.59,
    volume24h: 8745,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 78,
      recasts: 15,
      likes: 63,
    },
    createdAt: "2 months ago",
  },
  {
    id: "4",
    name: "dogwifstreamer",
    symbol: "WIF",
    marketCap: 61700,
    marketCapChange: -1.56,
    volume24h: 1020,
    imageUrl: "/tokens/dogwhif.jpeg",
    creator: {
      name: "zeni",
      score: 35,
      recasts: 3,
      likes: 32,
    },
    createdAt: "20 days ago",
  },
];

export function TokenGrid() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTokens = defaultTokens.filter((token) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      token.name.toLowerCase().includes(searchLower) ||
      token.symbol.toLowerCase().includes(searchLower) ||
      token.creator.name.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTokens.map((token) => (
          <TokenCardComponent key={token.id} token={token} />
        ))}
      </div>
      {filteredTokens.length === 0 && (
        <div className="text-center py-12 opacity-60">
          No tokens found matching &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}
