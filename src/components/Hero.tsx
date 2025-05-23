"use client";

import { useState, useEffect } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import { Token } from "@/src/app/types/token";
import { HeroAnimation } from "./HeroAnimation";

// Move these from page.tsx to here
// const initialTotal = 4234567.89; // About $4.2M
// const ratePerSecond = 52.45; // About $4.5M per day

export function Hero() {
  const [totalRewards, setTotalRewards] = useState(0);

  useEffect(() => {
    // Fetch tokens and calculate total rewards
    async function fetchTotalRewards() {
      try {
        const response = await fetch("/api/tokens");
        const data = await response.json();
        const tokens: Token[] = data.data;

        // Calculate initial rewards for all tokens
        const rewards = await Promise.all(
          tokens.map((token) =>
            calculateRewards(
              token.created_at,
              token.contract_address,
              token.staking_pool
            ).then((r) => r.totalStreamed)
          )
        );

        // Sum up all rewards
        const total = rewards.reduce((acc, curr) => acc + curr, 0);
        setTotalRewards(total);
      } catch (error) {
        console.error("Error fetching total rewards:", error);
      }
    }

    fetchTotalRewards();
  }, []);

  // Keep animating the total
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalRewards((prev) => prev + REWARDS_PER_SECOND / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="layout w-full max-w-[1440px] h-[300px] mb-[-50px] relative mt-28 md:mt-20">
      {/* Hero Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center">
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-4">
          <span className="text-primary drop-shadow-sm">Ape.</span>{" "}
          <span className="text-secondary drop-shadow-sm">Stake.</span>{" "}
          <span className="text-accent drop-shadow-sm">Earn.</span>
        </h1>

        <div className="text-2xl font-semibold mb-8">
          <span className="font-mono">
            {totalRewards.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="opacity-60"> rewards stremed</span>
        </div>
      </div>

      {/* Animation Container */}
      <HeroAnimation />
    </div>
  );
}
