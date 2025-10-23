"use client";

import { useState, useEffect, memo } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import { Token } from "@/src/app/types/token";
import { HeroAnimation } from "./HeroAnimation";
import { useRewardCounter } from "@/src/hooks/useStreamingNumber";

// Move these from page.tsx to here
// const initialTotal = 4234567.89; // About $4.2M
// const ratePerSecond = 52.45; // About $4.5M per day

const HeroComponent = () => {
  const [initialTotalRewards, setInitialTotalRewards] = useState(0);

  // Use the reward counter hook for animated total rewards
  const { currentRewards: currentTotalRewards } = useRewardCounter(
    initialTotalRewards,
    REWARDS_PER_SECOND,
    100 // Balanced between performance and smoothness
  );

  useEffect(() => {
    // Fetch tokens and calculate total rewards
    async function fetchTotalRewards() {
      try {
        const response = await fetch("/api/tokens?type=all");
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
        setInitialTotalRewards(total);
      } catch (error) {
        console.error("Error fetching total rewards:", error);
      }
    }

    fetchTotalRewards();
  }, []);

  return (
    <div className="layout w-full max-w-[1440px] mx-auto h-[300px] mb-[-50px] relative mt-10">
      {/* Hero Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center">
        {/* Transparent background container */}
        <div className=" bg-base-100/1 border border-base-300/20 rounded-3xl px-8 py-6 md:px-12 md:py-8">
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight mb-4">
            <span className="text-primary drop-shadow-sm">Ape.</span>{" "}
            <span className="text-secondary drop-shadow-sm">Stake.</span>{" "}
            <span className="text-accent drop-shadow-sm">Earn.</span>
          </h1>
          <div className="flex flex-col">
            <span className="font-mono text-2xl font-semibold  md:text-3xl">
              {currentTotalRewards.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
            <span className="text-base-content/60 font-medium text-lg">
              {" "}
              rewards streamed
            </span>
          </div>
        </div>
      </div>

      {/* Animation Container */}
      <HeroAnimation />
    </div>
  );
};

export const Hero = memo(HeroComponent);

Hero.displayName = "Hero";
