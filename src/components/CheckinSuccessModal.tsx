"use client";

import { useEffect, useCallback, useState } from "react";
import { useStremeFlowRate } from "../hooks/useStremeFlowRate";
import { useStremeBalance } from "../hooks/useStremeBalance";
import Image from "next/image";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import sdk from "@farcaster/miniapp-sdk";
import confetti from "canvas-confetti";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

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
  dropAmount,
}: CheckinSuccessModalProps) {
  const [showInfo, setShowInfo] = useState(false);
  const { isSDKLoaded, isMiniAppView, address: fcAddress } = useAppFrameLogic();
  const { address: wagmiAddress } = useAccount();
  const {
    flowRate,
    isLoading: flowRateLoading,
    refetch: refetchFlowRate,
  } = useStremeFlowRate();

  const {
    balance,
    updateFlowRate: updateFlowRateRaw,
    refetch: refetchBalance,
  } = useStremeBalance();

  // State for calculated flow rate
  const [calculatedFlowRate, setCalculatedFlowRate] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Get effective address
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  // Stabilize function references
  const updateFlowRate = useCallback(
    (rate: string) => {
      updateFlowRateRaw(rate);
    },
    [updateFlowRateRaw]
  );

  // Calculate new flow rate based on drop amount
  const calculateNewFlowRate = useCallback(async () => {
    if (!effectiveAddress || !dropAmount) return;
    
    setIsCalculating(true);
    try {
      // Fetch current stSTREME balance and pool data
      const stakingPool = "0xcbc2caf425f8cdca774128b3d14de37f2224b964";
      const stSTREME_ADDRESS = "0x4eb4db20f96c51b088ad5afe1fa963ab36a5c602";
      
      // Get current stSTREME balance
      const query = `
        query UserPoolData {
          pool(id: "${stakingPool.toLowerCase()}") {
            totalUnits
            flowRate
            totalSupply
          }
          poolMember(id: "${stakingPool.toLowerCase()}-${effectiveAddress.toLowerCase()}") {
            units
          }
          tokenStatistic(id: "${stSTREME_ADDRESS.toLowerCase()}") {
            totalSupply
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
        const currentMember = data.data.poolMember;
        
        // Get current units (stSTREME balance)
        const currentUnits = BigInt(currentMember?.units || "0");
        // Add the drop amount (converted to wei)
        const dropAmountWei = BigInt(parseFloat(dropAmount) * 1e18);
        const newUnits = currentUnits + dropAmountWei;
        
        // Calculate total units after drop (assuming drop succeeds)
        const totalUnits = BigInt(poolData.totalUnits || "0") + dropAmountWei;
        
        if (totalUnits > 0n) {
          const percentage = (Number(newUnits) * 100) / Number(totalUnits);
          const totalFlowRate = Number(formatUnits(BigInt(poolData.flowRate), 18));
          const userFlowRate = totalFlowRate * (percentage / 100);
          const flowRatePerDay = userFlowRate * 86400;
          
          setCalculatedFlowRate(flowRatePerDay.toFixed(4));
        }
      }
    } catch (error) {
      console.error("[CheckinSuccessModal] Error calculating flow rate:", error);
    } finally {
      setIsCalculating(false);
    }
  }, [effectiveAddress, dropAmount]);

  // Trigger confetti effect when modal opens
  useEffect(() => {
    if (isOpen) {
      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#8b5cf6", "#3b82f6", "#60a5fa"],
      });

      console.log("[CheckinSuccessModal] Modal opened, fetching flow rate...");
      refetchFlowRate();
      refetchBalance();
      calculateNewFlowRate();
    }
  }, [isOpen, calculateNewFlowRate]); // Include calculateNewFlowRate

  // Update balance flow rate when flow rate changes
  useEffect(() => {
    if (flowRate && !flowRateLoading) {
      updateFlowRate(flowRate);
    }
  }, [flowRate, flowRateLoading, updateFlowRate]);

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

Just claimed my daily staked $STREME drop and my new flow rate is ${
      calculatedFlowRate
        ? `${parseInt(calculatedFlowRate).toLocaleString()} STREME/day`
        : flowRate === "0"
        ? "Starting soon"
        : `${parseInt(flowRate).toLocaleString()} STREME/day`
    }

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-lg p-6 max-w-sm w-full text-center relative"
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

        {dropAmount && (
          <div className="rounded p-2 mb-6">
            <p className="font-semibold text-primary"></p>
            <p className="text-sm text-base-content/70">
              {dropAmount}{" "}
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
                    Staked $STREME qualifies you for a rewards flow. Buy and
                    stake more to increase your flow rate!
                  </span>
                )}
              </span>{" "}
              sent to your wallet.
              <br />
              Your new flow rate is{" "}
              {isCalculating || flowRateLoading ? (
                <span className="loading loading-dots loading-xs"></span>
              ) : calculatedFlowRate ? (
                <span className="text-success font-semibold">
                  {parseInt(calculatedFlowRate).toLocaleString()} $STREME/day
                </span>
              ) : flowRate === "0" ? (
                "starting soon"
              ) : (
                `${parseInt(flowRate).toLocaleString()} $STREME/day`
              )}
            </p>
          </div>
        )}

        {/* Balance Display */}
        <div className="mb-6">
          <div className="text-xs text-base-content/60 mb-1">
            Your STREME Balance
          </div>
          <div className="text-2xl font-mono font-bold text-primary">
            {balance.toFixed(4)}
          </div>
          <div className="text-xs text-base-content/60 mt-1">
            {isCalculating || flowRateLoading ? (
              <span>Calculating flow...</span>
            ) : calculatedFlowRate ? (
              <span className="text-success">
                +{parseInt(calculatedFlowRate).toLocaleString()} per day (after drop)
              </span>
            ) : flowRate === "0" ? (
              <span>Not streaming yet</span>
            ) : (
              <span className="text-success">
                +{parseInt(flowRate).toLocaleString()} per day
              </span>
            )}
          </div>
        </div>

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
