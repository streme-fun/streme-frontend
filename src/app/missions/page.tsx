"use client";

import { useState, useEffect } from "react";
import { Mission, MissionCategory, MissionStats } from "@/src/app/types/mission";
import { MissionCard } from "@/src/components/MissionCard";
import { MissionStreamAnimation } from "@/src/components/MissionStreamAnimation";
import { MissionLeaderboard } from "@/src/components/MissionLeaderboard";
import { UserContributions } from "@/src/components/UserContributions";
import { useStremePrice } from "@/src/hooks/useStremePrice";
import { useMissionContributors } from "@/src/hooks/useMissionContributors";

export default function MissionsPage() {
  const [missionStats, setMissionStats] = useState<MissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { price } = useStremePrice();
  const { contributors, totalBalance } = useMissionContributors();

  // Featured mission: Fund QR Auction Win
  const featuredMission: Mission = {
    id: "qr-auction-fund",
    title: "Fund QR Auction Win",
    description: "Help Streme win the daily QR auction at qrcoin.fun! Winners decide where the QR code points for that day, bringing massive attention to their website through daily announcements on X, Farcaster notifications, and growing physical/digital QR distribution. Your staked $STREME funds our bid to showcase Streme to thousands of viewers.",
    imageUrl: "/api/placeholder/600/300",
    goal: 1000, // $1000 USD goal
    currentAmount: 0, // Will be calculated from actual contributions
    startDate: "2024-12-01T00:00:00Z",
    endDate: undefined, // No end date - ongoing
    isActive: true,
    category: MissionCategory.DEVELOPMENT,
    totalContributors: 47,
    createdBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e",
    rewards: []
  };
  
  // Calculate USD value of contributions
  const totalStremeAmount = totalBalance ? Number(totalBalance) / 1e18 : 0;
  const totalUsdValue = price ? totalStremeAmount * price : 0;
  const progressPercentage = (totalUsdValue / featuredMission.goal) * 100;
  
  // Calculate estimated completion time
  // Assuming $50/day average contribution rate based on current progress
  const dailyRate = contributors.length > 0 ? totalUsdValue / Math.max(1, contributors.length) : 50;
  const remainingUsd = featuredMission.goal - totalUsdValue;
  const estimatedDays = Math.ceil(remainingUsd / dailyRate);

  useEffect(() => {
    // Simulate API call
    const mockStats: MissionStats = {
      totalMissions: 1,
      activeMissions: 1,
      totalValueLocked: 12500000,
      totalContributors: 47,
      completedMissions: 0
    };
    
    setTimeout(() => {
      setMissionStats(mockStats);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="absolute inset-0">
          <MissionStreamAnimation />
        </div>
        <div className="relative container mx-auto px-4 py-16">
          <div className="text-center space-y-6">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Fund QR Auction Win
            </h1>
            <p className="text-xl text-base-content/70 max-w-3xl mx-auto">
              Help Streme win the daily auction at <a href="https://qrcoin.fun" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">qrcoin.fun</a>! 
              Winners get massive exposure through daily announcements reaching thousands of viewers. 
              Your staked $STREME funds our winning bids.
            </p>
            
            {/* Mission Progress Stats */}
            {missionStats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8 max-w-2xl mx-auto">
                <div className="bg-base-200/50 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold text-primary">
                    ${totalUsdValue.toFixed(0)}
                  </div>
                  <div className="text-sm text-base-content/70">USD Raised</div>
                  <div className="text-xs text-base-content/50">
                    {totalStremeAmount > 1000000 ? `${(totalStremeAmount / 1000000).toFixed(1)}M` : totalStremeAmount.toFixed(0)} $STREME
                  </div>
                </div>
                <div className="bg-base-200/50 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold text-secondary">{contributors.length}</div>
                  <div className="text-sm text-base-content/70">Contributors</div>
                </div>
                <div className="bg-base-200/50 backdrop-blur-sm rounded-lg p-4">
                  <div className="text-2xl font-bold text-accent">
                    {progressPercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-base-content/70">Complete</div>
                  <div className="text-xs text-base-content/50">
                    ~{estimatedDays} days to goal
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* User Contributions Section - Make withdrawal obvious */}
        <div className="max-w-4xl mx-auto mb-8">
          <UserContributions />
        </div>

        {/* Featured Mission Display */}
        <div className="max-w-4xl mx-auto mb-12 mission-card">
          <MissionCard
            mission={{
              ...featuredMission,
              currentAmount: totalStremeAmount, // Pass STREME amount, MissionCard will convert to USD
              totalContributors: contributors.length
            }}
          />
        </div>

        {/* How It Works */}
        <div className="bg-base-200 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">💡 How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-base-100 rounded-lg p-4">
              <div className="text-3xl mb-3">1️⃣</div>
              <h3 className="font-semibold mb-2">You Contribute $STREME</h3>
              <p className="text-sm text-base-content/70">
                Stake your $STREME tokens to the mission fund. Your tokens remain yours and can be withdrawn anytime.
              </p>
            </div>
            <div className="bg-base-100 rounded-lg p-4">
              <div className="text-3xl mb-3">2️⃣</div>
              <h3 className="font-semibold mb-2">We Bid Daily</h3>
              <p className="text-sm text-base-content/70">
                The pooled funds are used to bid on qrcoin.fun&apos;s daily QR auction. Winners control where the QR points for 24 hours.
              </p>
            </div>
            <div className="bg-base-100 rounded-lg p-4">
              <div className="text-3xl mb-3">3️⃣</div>
              <h3 className="font-semibold mb-2">Massive Exposure</h3>
              <p className="text-sm text-base-content/70">
                When we win, thousands see Streme through X announcements, Farcaster notifications, and the growing QR network.
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-primary/10 rounded-lg">
            <p className="text-sm">
              <strong>Goal:</strong> Raise $1,000 USD to secure multiple auction wins
              <br />
              <strong>Current Progress:</strong> ${totalUsdValue.toFixed(2)} ({progressPercentage.toFixed(1)}%)
              <br />
              <strong>Estimated Completion:</strong> {estimatedDays} days at current rate
            </p>
          </div>
        </div>

        {/* Mission Leaderboard */}
        <div className="bg-base-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            🏆 QR Auction Contributors
          </h2>
          <div className="mb-4 text-sm text-base-content/70">
            Supporting Streme&apos;s bids on <a href="https://qrcoin.fun" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">qrcoin.fun</a> daily auctions
          </div>
          <MissionLeaderboard missionId={featuredMission.id} />
        </div>
      </div>
    </div>
  );
}