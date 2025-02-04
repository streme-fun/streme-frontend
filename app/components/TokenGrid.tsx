"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { Pagination } from "./Pagination";
import { SortMenu } from "./SortMenu";

type TokenCard = {
  id: string;
  address: string;
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
    <Link href={`/token/${token.address}`} className="block group">
      <div
        className="card card-side bg-base-100 rounded-none border-3 border-base-900 
        hover:bg-black/[.02] dark:hover:bg-white/[.02] transition-all duration-300 ease-out
        hover:shadow-lg hover:-translate-y-1 group-hover:border-primary/20"
      >
        {token.imageUrl ? (
          <figure className="w-[120px] h-[120px] relative overflow-hidden">
            <Image
              src={token.imageUrl}
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
                  token.marketCapChange >= 0
                    ? "text-green-500 group-hover:text-green-400"
                    : "text-red-500 group-hover:text-red-400"
                } gap-1 rounded-none text-xs`}
              >
                {token.marketCapChange >= 0 ? "+" : ""}
                {token.marketCapChange.toFixed(2)}%
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <div className="avatar transition-transform duration-300 group-hover:scale-110">
                <div className="rounded-full w-4 h-4">
                  <Image
                    src={`/avatars/${token.creator.name}.avif`}
                    alt={token.creator.name}
                    width={16}
                    height={16}
                  />
                </div>
              </div>
              <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                {token.creator.name}
              </span>
              <div className="flex items-center gap-2 ml-auto text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                <span className="hover:text-primary">
                  🔄 {token.creator.recasts}
                </span>
                <span className="hover:text-primary">
                  ❤️ {token.creator.likes}
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

const defaultTokens: TokenCard[] = [
  {
    id: "1",
    address: "0x1234567890123456789012345678901234567890",
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
    address: "0x2345678901234567890123456789012345678901",
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
    address: "0x3456789012345678901234567890123456789012",
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
    address: "0x4567890123456789012345678901234567890123",
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
  {
    id: "5",
    address: "0x5678901234567890123456789012345678901234",
    name: "StreamPepe",
    symbol: "SPEPE",
    marketCap: 358000,
    marketCapChange: 2.5,
    volume24h: 89246,
    imageUrl: "/tokens/pepe.jpeg",
    creator: {
      name: "zeni",
      score: 45,
      recasts: 8,
      likes: 41,
    },
    createdAt: "1 month ago",
  },
  {
    id: "6",
    address: "0x6789012345678901234567890123456789012345",
    name: "FlowDoge",
    symbol: "FLOWG",
    marketCap: 285000,
    marketCapChange: 1.2,
    volume24h: 45321,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 38,
      recasts: 5,
      likes: 29,
    },
    createdAt: "2 weeks ago",
  },
  {
    id: "7",
    address: "0x7890123456789012345678901234567890123456",
    name: "RiverRocket",
    symbol: "RVRKT",
    marketCap: 725000,
    marketCapChange: -0.8,
    volume24h: 123456,
    imageUrl: "/tokens/riverdog.jpg",
    creator: {
      name: "zeni",
      score: 65,
      recasts: 12,
      likes: 54,
    },
    createdAt: "3 months ago",
  },
  {
    id: "8",
    address: "0x8901234567890123456789012345678901234567",
    name: "WaterfallInu",
    symbol: "WFINU",
    marketCap: 142000,
    marketCapChange: 2.1,
    volume24h: 31865,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 42,
      recasts: 6,
      likes: 35,
    },
    createdAt: "1 week ago",
  },
  {
    id: "9",
    address: "0x9012345678901234567890123456789012345678",
    name: "StreamShiba",
    symbol: "STRSHIB",
    marketCap: 425000,
    marketCapChange: 0.3,
    volume24h: 67893,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 51,
      recasts: 9,
      likes: 43,
    },
    createdAt: "1 month ago",
  },
  {
    id: "10",
    address: "0xA123456789012345678901234567890123456789",
    name: "TorrentMoon",
    symbol: "TRMOON",
    marketCap: 180000,
    marketCapChange: 0.1,
    volume24h: 24875,
    imageUrl: "/tokens/moon.jpeg",
    creator: {
      name: "zeni",
      score: 33,
      recasts: 4,
      likes: 27,
    },
    createdAt: "5 days ago",
  },
  {
    id: "11",
    address: "0xB123456789012345678901234567890123456789",
    name: "FluxFloki",
    symbol: "FLXFLK",
    marketCap: 267000,
    marketCapChange: -0.2,
    volume24h: 42187,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 47,
      recasts: 7,
      likes: 38,
    },
    createdAt: "2 weeks ago",
  },
  {
    id: "12",
    address: "0xC123456789012345678901234567890123456789",
    name: "RapidRabbit",
    symbol: "RPDRBT",
    marketCap: 391000,
    marketCapChange: 0.4,
    volume24h: 54762,
    imageUrl: "/tokens/riverrabbit.jpeg",
    creator: {
      name: "zeni",
      score: 56,
      recasts: 10,
      likes: 45,
    },
    createdAt: "1 month ago",
  },
  {
    id: "13",
    address: "0xD123456789012345678901234567890123456789",
    name: "CascadeCat",
    symbol: "CSCAT",
    marketCap: 154000,
    marketCapChange: 0.2,
    volume24h: 38214,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 39,
      recasts: 5,
      likes: 31,
    },
    createdAt: "1 week ago",
  },
  {
    id: "14",
    address: "0xE123456789012345678901234567890123456789",
    name: "VelocityVibe",
    symbol: "VVIBE",
    marketCap: 589000,
    marketCapChange: -0.1,
    volume24h: 98342,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 62,
      recasts: 11,
      likes: 51,
    },
    createdAt: "2 months ago",
  },
  {
    id: "15",
    address: "0xF123456789012345678901234567890123456789",
    name: "StreamStonks",
    symbol: "STRNK",
    marketCap: 272000,
    marketCapChange: 0.3,
    volume24h: 47623,
    imageUrl: "/tokens/rivercat.jpg",
    creator: {
      name: "zeni",
      score: 48,
      recasts: 8,
      likes: 39,
    },
    createdAt: "3 weeks ago",
  },
  {
    id: "16",
    address: "0xG123456789012345678901234567890123456789",
    name: "FlowFren",
    symbol: "FLFREN",
    marketCap: 149000,
    marketCapChange: 0.5,
    volume24h: 29356,
    imageUrl: "",
    creator: {
      name: "zeni",
      score: 37,
      recasts: 4,
      likes: 30,
    },
    createdAt: "4 days ago",
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
