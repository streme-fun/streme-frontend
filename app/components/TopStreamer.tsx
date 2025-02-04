"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

// Using the same TokenCard type from TokenGrid
const featuredToken = {
  id: "featured",
  address: "0x1234567890123456789012345678901234567890",
  name: "Based Fwog",
  symbol: "FWOG",
  marketCap: 459510,
  marketCapChange: 12.77,
  volume24h: 12420,
  imageUrl: "/tokens/skimochi.avif",
  creator: {
    name: "zeni",
    score: 79,
    recasts: 17,
    likes: 62,
  },
  createdAt: "2 months ago",
};

export function TopStreamer() {
  const [rewards, setRewards] = useState(featuredToken.marketCap * 0.01);

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + (featuredToken.marketCap * 0.0001) / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-[1200px] mx-auto mb-8">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold tracking-tight">
          🏆 CURRENT KING OF REWARDS
        </h2>
      </div>

      <div className="max-w-md mx-auto">
        <Link href={`/token/${featuredToken.address}`} className="block group">
          <div
            className="card card-side bg-base-100 rounded-none border-3 border-base-900 
            hover:bg-black/[.02] dark:hover:bg-white/[.02] transition-all duration-300 ease-out
            hover:shadow-lg hover:-translate-y-1 group-hover:border-primary/20"
          >
            {featuredToken.imageUrl ? (
              <figure className="w-[120px] h-[120px] relative overflow-hidden">
                <Image
                  src={featuredToken.imageUrl}
                  alt={featuredToken.name}
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
                ${featuredToken.symbol}
              </div>
            )}
            <div className="card-body p-2 gap-2">
              <div>
                <h2 className="card-title text-sm group-hover:text-primary transition-colors duration-300">
                  {featuredToken.name}
                </h2>
                <div className="flex items-center justify-between">
                  <div
                    className={`transition-all duration-300 ${
                      featuredToken.marketCapChange >= 0
                        ? "text-green-500 group-hover:text-green-400"
                        : "text-red-500 group-hover:text-red-400"
                    } gap-1 rounded-none text-xs`}
                  >
                    {featuredToken.marketCapChange >= 0 ? "+" : ""}
                    {featuredToken.marketCapChange.toFixed(2)}%
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <div className="avatar transition-transform duration-300 group-hover:scale-110">
                    <div className="rounded-full w-4 h-4">
                      <Image
                        src={`/avatars/${featuredToken.creator.name}.avif`}
                        alt={featuredToken.creator.name}
                        width={16}
                        height={16}
                      />
                    </div>
                  </div>
                  <span className="text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                    {featuredToken.creator.name}
                  </span>
                  <div className="flex items-center gap-2 ml-auto text-xs opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="hover:text-primary">
                      🔄 {featuredToken.creator.recasts}
                    </span>
                    <span className="hover:text-primary">
                      ❤️ {featuredToken.creator.likes}
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
      </div>
    </div>
  );
}
