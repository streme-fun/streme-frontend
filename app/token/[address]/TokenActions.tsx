"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

// Using one of the mock tokens from TokenGrid
const tokenInfo = {
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
  staking: {
    apy: 156.8,
    stakers: 1247,
    totalStaked: 245690,
    rewardsDistributed: 123456.78,
    rewardRate: 1.85, // Per second
  },
};

type Tab = "buy" | "sell" | "stake";

export function TokenActions() {
  const [activeTab, setActiveTab] = useState<Tab>("buy");
  const [amount, setAmount] = useState<string>("");
  const [rewards, setRewards] = useState(tokenInfo.staking.rewardsDistributed);

  // More realistic WETH amounts (0.1, 0.5, 1.0)
  const presetAmounts = ["0.01", "0.05", "0.1"];

  const handlePresetClick = (value: string) => {
    setAmount(value);
  };

  const handleReset = () => {
    setAmount("");
  };

  const handlePlaceTrade = () => {
    // TODO: Implement trade/stake logic
    console.log(`Placing ${activeTab} order for ${amount} WETH`);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + tokenInfo.staking.rewardRate / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
      <div className="card-body p-4">
        {/* Token Info Section */}
        <div className="mb-8 space-y-6">
          {/* Token Header */}
          <div className="flex items-center gap-4">
            {tokenInfo.imageUrl ? (
              <div className="relative w-16 h-16">
                <Image
                  src={tokenInfo.imageUrl}
                  alt={tokenInfo.name}
                  fill
                  className="object-cover rounded-full"
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-primary flex items-center justify-center text-primary-content font-mono font-bold rounded-full">
                ${tokenInfo.symbol}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold mb-1">{tokenInfo.name}</h2>
              <div className="flex items-center gap-3">
                <span className="text-base opacity-60">
                  ${tokenInfo.symbol}
                </span>
                <span
                  className={`text-base ${
                    tokenInfo.marketCapChange >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {tokenInfo.marketCapChange >= 0 ? "+" : ""}
                  {tokenInfo.marketCapChange.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Market Stats */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-base opacity-60 mb-2">Market Cap</div>
                <div className="font-mono text-xl">
                  ${tokenInfo.marketCap.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-base opacity-60 mb-2">24h Volume</div>
                <div className="font-mono text-xl">
                  ${tokenInfo.volume24h.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-base opacity-60 mb-2">Staking APY</div>
                <div className="font-mono text-xl text-green-500">
                  {tokenInfo.staking.apy.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-base opacity-60 mb-2">Total Stakers</div>
                <div className="font-mono text-xl">
                  {tokenInfo.staking.stakers.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Rewards Counter */}
          <div>
            <div className="text-base opacity-60 mb-2">Rewards Distributed</div>
            <div className="font-mono text-2xl font-bold text-primary">
              $
              {rewards.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-sm opacity-40 mt-1">
              {tokenInfo.staking.rewardRate.toFixed(2)} $FWOG/sec
            </div>
          </div>

          {/* Creator Info */}
          <div className="flex items-center gap-2">
            <div className="avatar">
              <div className="w-6 h-6 rounded-full">
                <Image
                  src={`/avatars/${tokenInfo.creator.name}.avif`}
                  alt={tokenInfo.creator.name}
                  width={24}
                  height={24}
                />
              </div>
            </div>
            <span className="text-base opacity-60">
              {tokenInfo.creator.name}
            </span>
            <div className="flex items-center gap-3 ml-auto opacity-60">
              <span>🔄 {tokenInfo.creator.recasts}</span>
              <span>❤️ {tokenInfo.creator.likes}</span>
            </div>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 btn ${
              activeTab === "buy"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => setActiveTab("buy")}
          >
            BUY
          </button>
          <button
            className={`flex-1 btn ${
              activeTab === "sell"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => setActiveTab("sell")}
          >
            SELL
          </button>
          <button
            className={`flex-1 btn ${
              activeTab === "stake"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => setActiveTab("stake")}
          >
            STAKE
          </button>
        </div>

        {/* Max Slippage Button */}
        <button className="btn btn-sm btn-ghost bg-black/[.02] dark:bg-white/[.02] w-fit mb-4">
          SET MAX SLIPPAGE
        </button>

        {/* Amount Input */}
        <div className="relative mb-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input input-ghost bg-black/[.02] dark:bg-white/[.02] w-full pr-20 font-mono text-2xl"
          />
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            <span className="font-mono">WETH</span>
          </div>
        </div>

        {/* Preset Amounts */}
        <div className="flex gap-2 mb-4">
          <button
            className="btn btn-sm btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            onClick={handleReset}
          >
            RESET
          </button>
          {presetAmounts.map((preset) => (
            <button
              key={preset}
              className="btn btn-sm btn-ghost bg-black/[.02] dark:bg-white/[.02]"
              onClick={() => handlePresetClick(preset)}
            >
              {preset} WETH
            </button>
          ))}
        </div>

        {/* Place Trade Button */}
        <button
          className="btn btn-primary w-full"
          onClick={handlePlaceTrade}
          disabled={!amount}
        >
          {activeTab === "buy"
            ? "PLACE BUY ORDER"
            : activeTab === "sell"
            ? "PLACE SELL ORDER"
            : "STAKE TOKENS"}
        </button>
      </div>
    </div>
  );
}
