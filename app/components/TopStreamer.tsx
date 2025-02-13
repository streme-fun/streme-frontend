"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Token } from "@/app/types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";

export function TopStreamer() {
  const [token, setToken] = useState<Token | null>(null);
  const [rewards, setRewards] = useState(0);

  useEffect(() => {
    // Fetch tokens and randomly select one
    async function fetchRandomToken() {
      try {
        const response = await fetch("/api/tokens");
        const data = await response.json();
        const tokens: Token[] = data.data;

        // Randomly select a token
        const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
        setToken(randomToken);

        // Calculate initial rewards
        if (randomToken) {
          const { totalStreamed } = await calculateRewards(
            randomToken.created_at,
            randomToken.contract_address,
            randomToken.staking_pool
          );
          setRewards(totalStreamed);
        }
      } catch (error) {
        console.error("Error fetching random token:", error);
      }
    }

    fetchRandomToken();
  }, []);

  // Animate rewards
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      setRewards((prev) => prev + REWARDS_PER_SECOND / 20);
    }, 50);
    return () => clearInterval(interval);
  }, [token]);

  if (!token) return null;

  return (
    <div className="w-full max-w-[1200px] mx-auto mb-8">
      <div className="text-center mb-4">
        <h2 className="text-3xl font-bold tracking-tight">
          🏆 KING OF STREME REWARDS
        </h2>
      </div>

      <div className="max-w-md mx-auto">
        <Link href={`/token/${token.contract_address}`} className="block group">
          <div
            className="card card-side bg-base-100 border-1 border-gray-300 rounded-md 
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
                          token.creator?.profileImage ?? `/avatars/default.avif`
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
                </div>
              </div>

              <div className="card-actions justify-end mt-auto">
                <div className="w-full px-1 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider opacity-50 group-hover:opacity-70 transition-opacity duration-300">
                    Rewards
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
      </div>
    </div>
  );
}
