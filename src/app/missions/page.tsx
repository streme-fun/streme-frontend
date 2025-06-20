"use client";

import { Mission, MissionCategory } from "@/src/app/types/mission";
import { MissionCard } from "@/src/components/MissionCard";
// import { MissionLeaderboard } from "@/src/components/MissionLeaderboard";
import { UserContributions } from "@/src/components/UserContributions";
import { useStremePrice } from "@/src/hooks/useStremePrice";
// import { useMissionContributors } from "@/src/hooks/useMissionContributors";
import { useReadContract } from "wagmi";
import { ERC20_ABI } from "@/src/lib/contracts/StremeStakingRewardsFunder";
import { useState, useEffect, useRef } from "react";
import { useStreamingNumber } from "@/src/hooks/useStreamingNumber";
import { StreamAnimation } from "@/src/components/StreamAnimation";

export default function MissionsPage() {
  const { price } = useStremePrice();
  // const { contributors, loading } = useMissionContributors();

  // STREME token contract address
  const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
  // Deposit contract address
  const DEPOSIT_CONTRACT_ADDRESS = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b";

  // Read STREME token balance in the deposit contract
  const { data: stremeBalance, refetch: refetchStremeBalance } =
    useReadContract({
      address: STREME_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [DEPOSIT_CONTRACT_ADDRESS as `0x${string}`],
    });

  // State for animated balance
  const [baseStremeAmount, setBaseStremeAmount] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [stremeGrowthRate, setStremeGrowthRate] = useState<number>(0); // STREME per second
  const previousBalanceRef = useRef<number>(0);
  const lastBalanceUpdateRef = useRef<number>(Date.now());

  // Animated STREME balance
  const animatedStremeBalance = useStreamingNumber({
    baseAmount: baseStremeAmount,
    flowRatePerSecond: stremeGrowthRate,
    lastUpdateTime,
    updateInterval: 16, // ~60fps for ultra-smooth animation (16ms ≈ 60fps)
    pauseWhenHidden: true,
  });

  // Effect to track STREME balance changes and calculate growth rate
  useEffect(() => {
    if (!stremeBalance) return;

    const currentBalance = Number(stremeBalance) / 1e18;
    const now = Date.now();

    if (previousBalanceRef.current > 0) {
      const timeDiff = (now - lastBalanceUpdateRef.current) / 1000; // seconds
      const balanceDiff = currentBalance - previousBalanceRef.current;

      if (timeDiff > 0 && balanceDiff > 0) {
        const newGrowthRate = balanceDiff / timeDiff;
        setStremeGrowthRate(newGrowthRate);
      }
    }

    setBaseStremeAmount(currentBalance);
    setLastUpdateTime(now);
    previousBalanceRef.current = currentBalance;
    lastBalanceUpdateRef.current = now;
  }, [stremeBalance]);

  // Refetch STREME balance periodically to update growth rate
  useEffect(() => {
    const interval = setInterval(() => {
      refetchStremeBalance();
    }, 30000); // Refetch every 30 seconds

    return () => clearInterval(interval);
  }, [refetchStremeBalance]);

  // QR Auction Mission - Our single focused mission
  const qrMission: Mission = {
    id: "qr-auction-fund",
    title: "Fund QR Auction Win",
    description:
      "Pool funds to win daily auctions at qrcoin.fun. Winners control where a QR code points for 24 hours, getting massive exposure through X announcements and Farcaster notifications.",
    imageUrl: "/api/placeholder/600/300",
    goal: 1000, // $1000 USD goal
    currentAmount: 0, // Will be calculated from actual contributions
    startDate: "2024-12-01T00:00:00Z",
    endDate: undefined,
    isActive: true,
    category: MissionCategory.DEVELOPMENT,
    totalContributors: 0,
    createdBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e",
    rewards: [],
  };

  // Calculate values using animated balance
  const totalStremeAmount = animatedStremeBalance;
  const totalUsdValue = price ? totalStremeAmount * price : 0;
  const remainingUsd = Math.max(0, qrMission.goal - totalUsdValue);

  // Calculate growth rates for display
  const stremePerHour = stremeGrowthRate * 3600;
  const stremePerDay = stremeGrowthRate * 86400;
  const usdPerDay = price ? stremePerDay * price : 0;

  // Dynamic decimal precision based on growth rate
  const getDecimalPrecision = (growthRate: number): number => {
    // Always show at least 2 decimals for visible movement
    if (growthRate <= 0) return 2;

    // For very slow growth (< 0.001 STREME/second), show 6 decimals
    if (growthRate < 0.001) return 6;
    // For slow growth (< 0.01 STREME/second), show 4 decimals
    if (growthRate < 0.01) return 4;
    // For moderate growth (< 0.1 STREME/second), show 3 decimals
    if (growthRate < 0.1) return 3;
    // For faster growth (< 1 STREME/second), show 2 decimals
    if (growthRate < 1) return 2;
    // For very fast growth, minimum 2 decimals
    if (growthRate < 10) return 2;
    // For extremely fast growth, minimum 2 decimals
    return 2;
  };

  const decimalPrecision = getDecimalPrecision(stremeGrowthRate);

  return (
    <div className="min-h-screen mt-20">
      {/* Hero Section - Simplified and focused */}
      <div className="">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-lg uppercase text-base-600 mb-2">Mission</h1>
            <h2 className="text-3xl font-bold">Fund Streme $QR Auction Win</h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto mt-4">
              Redirect your staked STREME rewards to help Streme win a{" "}
              <a
                href="https://qrcoin.fun"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                qrcoin.fun
              </a>{" "}
              auction
            </p>

            {/* STREME Balance Display */}
            <div className="mt-6 p-4 rounded-lg max-w-4xl mx-auto">
              <div className="text-center">
                {/* Stream Animation */}
                <div className="mb-4">
                  <StreamAnimation
                    contributorCount={20} // Fixed count for animation
                    growthRate={Math.max(stremeGrowthRate, 0.1)} // Ensure some growth rate for testing
                  />
                </div>

                <div className="text-2xl font-bold font-mono">
                  {totalStremeAmount.toLocaleString("en-US", {
                    minimumFractionDigits: decimalPrecision,
                    maximumFractionDigits: decimalPrecision,
                  })}{" "}
                  STREME
                </div>
                <div className="text-lg font-semibold font-mono text-primary">
                  $
                  {totalUsdValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>

                {/* Growth Rate Display */}
                {stremeGrowthRate > 0 && (
                  <div className="mt-3 pt-3 border-t border-primary/20">
                    <div className="text-xs font-semibold text-primary/80 mb-1">
                      Growth Rate
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-base-100/50 rounded p-2">
                        <div className="font-semibold font-mono">
                          +
                          {stremePerHour.toLocaleString("en-US", {
                            minimumFractionDigits: Math.max(
                              2,
                              Math.min(decimalPrecision - 1, 4)
                            ),
                            maximumFractionDigits: Math.max(
                              2,
                              Math.min(decimalPrecision - 1, 4)
                            ),
                          })}
                        </div>
                        <div className="text-base-content/60">STREME/hour</div>
                      </div>
                      <div className="bg-base-100/50 rounded p-2">
                        <div className="font-semibold font-mono">
                          +$
                          {usdPerDay.toLocaleString("en-US", {
                            minimumFractionDigits:
                              stremeGrowthRate < 0.01 ? 4 : 2,
                            maximumFractionDigits:
                              stremeGrowthRate < 0.01 ? 4 : 2,
                          })}
                        </div>
                        <div className="text-base-content/60">USD/day</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* User Contributions - Prominent placement */}
        <div className="mb-6 sm:mb-8">
          <UserContributions />
        </div>

        {/* Mission Card - Central focus */}
        <div className="mb-8 sm:mb-12">
          <MissionCard
            mission={{
              ...qrMission,
              currentAmount: totalStremeAmount,
              totalContributors: 0,
            }}
          />
        </div>

        {/* How It Works */}
        <div className="bg-base-200 rounded-xl p-4 sm:p-6 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4">How It Works</h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="text-2xl">1️⃣</div>
              <div>
                <h3 className="font-semibold">Contribute Staked STREME</h3>
                <p className="text-sm text-base-content/70">
                  Your tokens remain yours and earn rewards. Withdraw anytime.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">2️⃣</div>
              <div>
                <h3 className="font-semibold">Win Daily Auctions</h3>
                <p className="text-sm text-base-content/70">
                  Pooled funds bid on qrcoin.fun. Winners control QR placement.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">3️⃣</div>
              <div>
                <h3 className="font-semibold">Drive Traffic to Streme</h3>
                <p className="text-sm text-base-content/70">
                  QR codes bring thousands of daily visitors to our platform.
                </p>
              </div>
            </div>
          </div>

          {/* Current Goal */}
          <div className="mt-6 p-4 bg-primary/10 rounded-lg">
            <div className="text-sm font-semibold mb-2">Current Goal</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Target:</span>
                <span className="font-semibold">${qrMission.goal}</span>
              </div>
              <div className="flex justify-between">
                <span>Remaining:</span>
                <span>${remainingUsd.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard - Commented out for future use */}
        {/* 
        <div className="bg-base-200 rounded-xl p-6 max-w-4xl mx-auto mt-8">
          <h2 className="text-xl font-bold mb-4">Top Contributors</h2>
          <MissionLeaderboard missionId={qrMission.id} />
        </div>
        */}
      </div>
    </div>
  );
}
