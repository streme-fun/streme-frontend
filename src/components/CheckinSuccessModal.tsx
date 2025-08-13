"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import sdk from "@farcaster/miniapp-sdk";
import confetti from "canvas-confetti";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { publicClient } from "../lib/viemClient";
import { useStreamingNumber } from "../hooks/useStreamingNumber";
import { ConnectPoolButton } from "./ConnectPoolButton";

interface CheckinSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  dropAmount?: string;
  totalCheckins?: number;
  currentStreak?: number;
}

export function CheckinSuccessModal({
  isOpen,
  onClose,
}: // dropAmount,
CheckinSuccessModalProps) {
  const [showInfo, setShowInfo] = useState(false);
  const {
    isSDKLoaded,
    isMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
  } = useAppFrameLogic();
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();

  // Balance animation state (based on StakedBalance)
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [flowRate, setFlowRate] = useState<string>("0");
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const [hasTriggeredEffects, setHasTriggeredEffects] = useState(false);
  const [isConnectedToPool, setIsConnectedToPool] = useState(false);
  const [hasCheckedPoolConnection, setHasCheckedPoolConnection] =
    useState(false);

  // Get effective connection state and address
  const effectiveIsConnected = isMiniAppView ? fcIsConnected : wagmiIsConnected;
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  // STREME token address
  const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
  const STREME_STAKING_POOL = "0xa040a8564c433970d7919c441104b1d25b9eaa1c";

  // Use streaming number hook for animated balance
  const flowRatePerSecond = Number(flowRate) / 86400; // Convert daily rate to per-second

  const currentBalance = useStreamingNumber({
    baseAmount,
    flowRatePerSecond,
    lastUpdateTime,
    updateInterval: 50, // 50ms for smooth animation (matches StakedBalance)
    pauseWhenHidden: true,
  });

  // Fetch balance and flow rate data (based on StakedBalance logic)
  const fetchBalanceData = async () => {
    if (!effectiveIsConnected || !effectiveAddress) return;

    // Prevent calls if we just fetched data recently (within 30 seconds)
    const now = Date.now();
    if (now - lastFetchTime < 30000) {
      console.log(
        "[CheckinSuccessModal] Skipping fetch - too soon since last fetch"
      );
      return;
    }

    try {
      setLastFetchTime(now);
      console.log(
        `[CheckinSuccessModal] Fetching balance for ${effectiveAddress}`
      );

      // Get STREME token balance
      const balance = await publicClient.readContract({
        address: STREME_TOKEN_ADDRESS as `0x${string}`,
        abi: [
          {
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [effectiveAddress as `0x${string}`],
      });

      const formattedBalance = Number(formatUnits(balance as bigint, 18));

      // Only update base amount and reset timer if the balance has actually changed
      // This prevents the streaming animation from restarting unnecessarily
      if (Math.abs(formattedBalance - baseAmount) > 0.0001) {
        setBaseAmount(formattedBalance);
        setLastUpdateTime(Date.now());
      } else if (baseAmount === 0) {
        // Force update on first load even if balance is 0 to initialize the animation
        setBaseAmount(formattedBalance);
        setLastUpdateTime(Date.now());
      }

      // Fetch pool data for flow rate
      const query = `
        query PoolData {
          pool(id: "${STREME_STAKING_POOL.toLowerCase()}") {
            totalUnits
            flowRate
            poolMembers(where: {account_: {id: "${effectiveAddress.toLowerCase()}"}}) {
              units
            }
          }
        }
      `;

      const response = await fetch(
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        }
      );

      const data = await response.json();

      if (data.data?.pool) {
        const poolData = data.data.pool;
        const member = poolData.poolMembers[0];

        if (member) {
          const totalUnits = BigInt(poolData.totalUnits || "0");
          const memberUnits = BigInt(member.units || "0");

          if (totalUnits > 0n && memberUnits > 0n) {
            const percentage = (Number(memberUnits) * 100) / Number(totalUnits);
            const totalFlowRate = Number(
              formatUnits(BigInt(poolData.flowRate), 18)
            );
            const userFlowRate = totalFlowRate * (percentage / 100);
            const flowRatePerDay = userFlowRate * 86400;

            setFlowRate(flowRatePerDay.toFixed(4));
            setIsConnectedToPool(true);
          } else {
            setIsConnectedToPool(false);
          }
        } else {
          // No member found, not connected to pool
          setIsConnectedToPool(false);
        }
      } else {
        setIsConnectedToPool(false);
      }

      // Mark that we've finished checking the pool connection
      setHasCheckedPoolConnection(true);
    } catch (error) {
      console.error(
        "[CheckinSuccessModal] Error fetching balance data:",
        error
      );
      // Mark that we've finished checking (even on error) to prevent infinite loading
      setHasCheckedPoolConnection(true);
    }
  };

  // Trigger confetti effect when modal opens (only once per open)
  useEffect(() => {
    if (isOpen && !hasTriggeredEffects) {
      setHasTriggeredEffects(true);

      // Fire confetti once
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#8b5cf6", "#3b82f6", "#60a5fa"],
      });

      console.log("[CheckinSuccessModal] Modal opened with drop amount: 1000");

      // Trigger balance refresh to show the updated amount
      fetchBalanceData();
    }
  }, [isOpen, hasTriggeredEffects]);

  // Fetch balance data when modal opens or when address changes
  useEffect(() => {
    if (isOpen && effectiveIsConnected && effectiveAddress) {
      fetchBalanceData();
    }
  }, [isOpen, effectiveIsConnected, effectiveAddress]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasTriggeredEffects(false);
      setHasCheckedPoolConnection(false);
    }
  }, [isOpen]);

  const handleShare = async () => {
    // Array of Streme-ified quotes with context
    const stremeQuotes = [
      'I\'m truly "Living the Streme!" 🌊',
      'As the song goes, "Sweet Stremes are made of this" 🎵',
      'Great grandma always said to "Follow your Stremes" 🛤️',
      'Time to "Streme big!" 💭',
      'As Walt said, "All our Stremes can come true" 🌟',
      'Today I "Dare to Streme!" 🎯',
      'They call us "The Streme Team" 🤝',
      'Welcome to my "Field of Stremes" 🌾',
      '"Streme a little Streme of me" as they say 🎶',
      'This is beyond my "wildest Stremes" 💫',
      'I call this the "Streme come true" moment ✨',
    ];

    // Pick a random quote
    const randomQuote =
      stremeQuotes[Math.floor(Math.random() * stremeQuotes.length)];

    const shareUrl = "https://streme.fun";
    const castText = `${randomQuote}

Just claimed my daily drop of 1000 staked $STREME just for opening the app!

${shareUrl}`;

    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: castText,
          embeds: [shareUrl],
        });
      } catch (error) {
        console.error("Error composing cast:", error);
        // Fallback to opening Farcaster
        window.open(
          `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
            castText
          )}&embeds[]=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
      }
    } else {
      // Desktop version - open Farcaster web compose
      window.open(
        `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
          castText
        )}&embeds[]=${encodeURIComponent(shareUrl)}`,
        "_blank"
      );
    }
  };

  const handleBuyStreme = () => {
    // Navigate to the STREME token page
    window.location.href = "/token/0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
  };

  const handleConnectPoolSuccess = async () => {
    // Update pool connection status immediately
    setIsConnectedToPool(true);
    // Then refresh balance data to get updated flow rate
    await fetchBalanceData();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-[100] p-0"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-t-2xl p-6 max-w-sm w-full text-center relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn btn-ghost btn-xs btn-circle"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-xl font-bold mb-4">Success!</h2>

        <div className="rounded p-2 mb-6">
          <p className="font-semibold text-primary"></p>
          <p className="text-sm text-base-content/70">
            1000{" "}
            <span
              className="relative inline-block group"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            >
              <span className="underline decoration-dotted cursor-help">
                staked $STREME
              </span>
              {showInfo && (
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-base-300 border border-base-500 rounded-lg shadow-lg text-left text-sm z-10">
                  Staked $STREME qualifies you for a rewards flow. Buy and stake
                  more to increase your flow rate!
                </span>
              )}
            </span>{" "}
            sent to your wallet!
          </p>
        </div>

        {/* Balance Display */}
        <div className="mb-10">
          <div className="text-xs text-base-content/60 mb-1">
            Your STREME Balance
          </div>
          <div className="text-2xl font-mono font-bold text-primary">
            {Number(flowRate) > 0
              ? currentBalance.toFixed(4)
              : baseAmount.toFixed(4)}
          </div>
          {Number(flowRate) > 0 && (
            <div className="text-xs text-base-content/60 mt-1">
              <span className="text-success">
                +{Number(flowRate).toLocaleString()} per day
              </span>
            </div>
          )}
        </div>

        {/* Connect Pool Button if not connected (only show after we've checked) */}
        {effectiveIsConnected &&
          hasCheckedPoolConnection &&
          !isConnectedToPool && (
            <div className="mb-6 p-4 bg-base-200 rounded-lg">
              <p className="text-sm text-base-content/70 mb-3">
                You&apos;re not connected to the STREME reward pool yet. Connect
                to start earning rewards on your staked STREME!
              </p>
              <ConnectPoolButton
                stakingPoolAddress={STREME_STAKING_POOL}
                onSuccess={handleConnectPoolSuccess}
                isMiniApp={isMiniAppView}
                farcasterAddress={effectiveAddress as string}
                farcasterIsConnected={effectiveIsConnected}
              />
            </div>
          )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Image
              src="/farcaster.svg"
              alt="Farcaster"
              width={20}
              height={20}
              className="brightness-0 invert"
            />
            Share
          </button>

          <button onClick={handleBuyStreme} className="btn btn-outline flex-1">
            Buy $STREME
          </button>
        </div>
      </div>
    </div>
  );
}
