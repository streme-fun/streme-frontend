"use client";

import { useState, useEffect } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";
import { Token } from "@/app/types/token";

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
    <div className="layout w-full max-w-[1440px] h-[300px] mb-[-50px] relative">
      {/* Hero Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center">
        <h1 className="text-7xl font-extrabold tracking-tight mb-4">
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
          <span className="opacity-60"> rewards distributed</span>
        </div>
      </div>

      {/* Animation Container */}
      <div className="wire-wrap relative w-full h-full opacity-70">
        <div className="w-embed absolute inset-0">
          <style>
            {`
              @keyframes slideMask {
                from {
                  x: -100%;
                }
                to {
                  x: 100%;
                }
              }

              @keyframes pulse {
                0%, 100% {
                  stroke-opacity: 0.3;
                }
                50% {
                  stroke-opacity: 0.6;
                }
              }

              @keyframes particleFlow {
                0% {
                  offset-distance: 0%;
                  opacity: 0;
                  transform: scale(0.8);
                }
                10% {
                  opacity: 0.7;
                  transform: scale(1);
                }
                90% {
                  opacity: 0.7;
                  transform: scale(1);
                }
                100% {
                  offset-distance: 100%;
                  opacity: 0;
                  transform: scale(0.8);
                }
              }

              .mask-rect {
                animation: slideMask 3.5s linear infinite;
              }

              .flow-line-1, .flow-line-2, .flow-line-3 {
                filter: drop-shadow(0 0 4px hsl(var(--b1) / 0.2));
              }

              .flow-line-1 {
                animation: pulse 4.2s ease-in-out infinite;
              }

              .flow-line-2 {
                animation: pulse 3.8s ease-in-out infinite;
              }

              .flow-line-3 {
                animation: pulse 4.5s ease-in-out infinite;
              }

              .reward-particle-1, .reward-particle-2, .reward-particle-3 {
                filter: drop-shadow(0 0 2px currentColor);
              }

              .reward-particle-1 {
                offset-path: path('M-100 80C200 80 400 100 800 200 C1200 300 1300 250 1540 250');
                animation: particleFlow 2.5s linear infinite;
              }

              .reward-particle-2 {
                offset-path: path('M-100 120C200 120 400 200 800 250 C1200 300 1300 300 1540 300');
                animation: particleFlow 3.2s linear infinite;
              }

              .reward-particle-3 {
                offset-path: path('M-100 180C200 180 400 300 800 300 C1200 300 1300 350 1540 350');
                animation: particleFlow 2.8s linear infinite;
              }
            `}
          </style>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1440 400"
            preserveAspectRatio="xMidYMid meet"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background gray lines */}
            <path
              d="M-100 80C200 80 400 100 800 200 C1200 300 1300 250 1540 250"
              stroke="hsl(220 13% 91%)"
              strokeWidth="4"
            ></path>
            <path
              d="M-100 120C200 120 400 200 800 250 C1200 300 1300 300 1540 300"
              stroke="hsl(220 13% 91%)"
              strokeWidth="4"
            ></path>
            <path
              d="M-100 180C200 180 400 300 800 300 C1200 300 1300 350 1540 350"
              stroke="hsl(220 13% 91%)"
              strokeWidth="4"
            ></path>

            {/* Reward Particles */}
            {/* Primary particles */}
            <g className="reward-particle-1">
              <circle r="8" fill="#2563eb" />
            </g>
            <g
              className="reward-particle-1"
              style={{ animationDelay: "-0.8s" }}
            >
              <circle r="7" fill="rgba(37, 99, 235, 0.9)" />
            </g>
            <g
              className="reward-particle-1"
              style={{ animationDelay: "-1.7s" }}
            >
              <circle r="6" fill="rgba(37, 99, 235, 0.8)" />
            </g>

            {/* Secondary particles */}
            <g className="reward-particle-2">
              <circle r="8" fill="#7c3aed" />
            </g>
            <g
              className="reward-particle-2"
              style={{ animationDelay: "-1.1s" }}
            >
              <circle r="7" fill="rgba(124, 58, 237, 0.9)" />
            </g>
            <g
              className="reward-particle-2"
              style={{ animationDelay: "-2.2s" }}
            >
              <circle r="6" fill="rgba(124, 58, 237, 0.8)" />
            </g>

            {/* Accent particles */}
            <g className="reward-particle-3">
              <circle r="8" fill="#dc2626" />
            </g>
            <g
              className="reward-particle-3"
              style={{ animationDelay: "-1.4s" }}
            >
              <circle r="7" fill="rgba(220, 38, 38, 0.9)" />
            </g>
            <g
              className="reward-particle-3"
              style={{ animationDelay: "-1.9s" }}
            >
              <circle r="6" fill="rgba(220, 38, 38, 0.8)" />
            </g>

            {/* Animated colored lines */}
            <defs>
              <linearGradient id="gradient">
                <stop offset="0" stopColor="white" stopOpacity="0"></stop>
                <stop offset="0.2" stopColor="white" stopOpacity="0.5"></stop>
                <stop offset="0.5" stopColor="white" stopOpacity="1"></stop>
                <stop offset="0.8" stopColor="white" stopOpacity="0.5"></stop>
                <stop offset="1" stopColor="white" stopOpacity="0"></stop>
              </linearGradient>
              <mask id="gradient-mask">
                <rect
                  className="mask-rect"
                  x="-100"
                  y="0"
                  width="120%"
                  height="100%"
                  fill="url(#gradient)"
                ></rect>
              </mask>
            </defs>
            <path
              className="flow-line-1"
              d="M-100 80C200 80 400 100 800 200 C1200 300 1300 250 1540 250"
              stroke="#2563eb"
              strokeWidth="4"
              mask="url(#gradient-mask)"
            ></path>
            <path
              className="flow-line-2"
              d="M-100 120C200 120 400 200 800 250 C1200 300 1300 300 1540 300"
              stroke="#7c3aed"
              strokeWidth="4"
              mask="url(#gradient-mask)"
            ></path>
            <path
              className="flow-line-3"
              d="M-100 180C200 180 400 300 800 300 C1200 300 1300 350 1540 350"
              stroke="#dc2626"
              strokeWidth="4"
              mask="url(#gradient-mask)"
            ></path>
          </svg>
        </div>
      </div>
    </div>
  );
}
