"use client";

import { useState, useEffect } from "react";
import { formatUnits, parseUnits } from "viem";
import { Modal } from "./Modal";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import sdk from "@farcaster/miniapp-sdk";
import Image from "next/image";
import FarcasterIcon from "@/public/farcaster.svg";
import { MyTokensModal } from "./MyTokensModal";
import Link from "next/link";

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  stakingAddress: string;
  balance: bigint;
  symbol: string;
  onStake: (amount: bigint) => Promise<void>;
  totalStakers?: string;
  onSuccess?: () => void;
  onRefreshBalance?: () => Promise<void>;
  isMiniApp?: boolean;
  lockDuration?: number; // Lock duration in seconds (defaults to 24h for v1 tokens)
}

const LoadingText = ({ text }: { text: string }) => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((r) => (r + 45) % 360);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="flex items-center gap-2">
      {text}
      <svg
        className="animate-spin h-4 w-4"
        viewBox="0 0 24 24"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </span>
  );
};

const formatBalance = (value: bigint, decimals: number = 18) => {
  return parseFloat(formatUnits(value, decimals)).toFixed(4);
};

const formatLockDuration = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) {
    return hours > 0 ? `${days} day${days > 1 ? "s" : ""} and ${hours} hour${hours > 1 ? "s" : ""}` : `${days} day${days > 1 ? "s" : ""}`;
  }

  return `${hours} hour${hours > 1 ? "s" : ""}`;
};

export function StakeModal({
  isOpen,
  onClose,
  tokenAddress,
  balance,
  symbol,
  onStake,
  totalStakers,
  onSuccess,
  onRefreshBalance,
  isMiniApp,
  lockDuration = 86400, // Default to 24 hours (86400 seconds) for v1 tokens
}: StakeModalProps) {
  const [amount, setAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState<"idle" | "staking" | "connecting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMaxAmount, setIsMaxAmount] = useState(false);
  const [showMyTokensModal, setShowMyTokensModal] = useState(false);

  const { isSDKLoaded } = useAppFrameLogic();

  const handleStake = async () => {
    setError(null);
    setIsStaking(true);
    setStep("staking");

    try {
      // Refresh balance when using max amount to ensure accuracy
      if (isMaxAmount && onRefreshBalance) {
        await onRefreshBalance();
      }

      // Use exact balance if max amount is selected to avoid precision loss
      // But apply a small buffer (0.1%) when using max to account for potential timing issues
      let stakeAmount: bigint;
      if (isMaxAmount) {
        // Round down by 0.1% to leave a small buffer
        const buffer = balance / 1000n; // 0.1% buffer
        const rawAmount = balance - buffer;

        // Round to 6 decimal places to prevent contract precision issues
        const amountInTokens = formatUnits(rawAmount, 18);
        const roundedAmount =
          Math.floor(parseFloat(amountInTokens) * 1000000) / 1000000; // 6 decimal places
        stakeAmount = parseUnits(roundedAmount.toString(), 18);

        // Ensure we don't go below zero
        if (stakeAmount <= 0n) {
          stakeAmount = balance;
        }
      } else {
        stakeAmount = parseUnits(amount, 18);
      }

      await onStake(stakeAmount);
      setIsSuccess(true);
      onSuccess?.();
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        if (error.message.includes("rejected")) {
          setError("Transaction rejected");
        } else if (error.message.includes("insufficient funds")) {
          setError("Insufficient funds for transaction");
        } else if (error.message.includes("Wallet not found")) {
          setError("Wallet not found. Please reconnect.");
        } else {
          setError("Failed to stake tokens. Please try again.");
        }
      } else {
        setError("An unexpected error occurred");
      }
      console.error("Staking error:", error);
      setIsSuccess(false);
    } finally {
      setIsStaking(false);
      setStep("idle");
    }
  };

  const handleClose = () => {
    setAmount("");
    setIsSuccess(false);
    setError(null);
    setIsMaxAmount(false);
    onClose();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
    setIsMaxAmount(false); // Reset max flag when user types
  };

  const handleMaxClick = () => {
    // Display a clean rounded amount in the UI (4 decimal places)
    const displayAmount = parseFloat(formatUnits(balance, 18)).toFixed(4);
    setAmount(displayAmount);
    setIsMaxAmount(true); // Set flag to use exact balance (with buffer) for transaction
  };

  const handleShare = async () => {
    const shareUrl = `https://streme.fun/token/${tokenAddress}`;
    const shareText = `I just staked $${symbol} on Streme for rewards streamed to my wallet every second. Stake it to make it!

${shareUrl}`;

    if (isMiniApp && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: shareText,
          embeds: [shareUrl],
        });
      } catch (error) {
        console.error("Error composing cast:", error);
        // Fallback to opening Farcaster
        window.open(
          `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
            shareText
          )}&embeds[]=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
      }
    } else {
      // Desktop version - open Farcaster web compose
      window.open(
        `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
          shareText
        )}&embeds[]=${encodeURIComponent(shareUrl)}`,
        "_blank"
      );
    }
  };

  if (isSuccess) {
    if (isMiniApp) {
      return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-base-100 rounded-t-2xl shadow-xl w-full max-w-md animate-in slide-in-from-bottom duration-300">
            <div className="p-4 space-y-3">
              <h3 className="text-lg font-bold">Stake Successful! 🎉</h3>
              <div className="relative h-24 w-full overflow-hidden rounded-lg">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 400 100"
                  preserveAspectRatio="xMidYMid meet"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 50 Q100 50 200 50 T400 50"
                    stroke="hsl(220 13% 91%)"
                    strokeWidth="2"
                  />
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.2s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.4s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.6s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.8s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                </svg>
                <style jsx>{`
                  .reward-particle {
                    animation: flow 2s linear infinite;
                  }
                  @keyframes flow {
                    from {
                      offset-distance: 0%;
                    }
                    to {
                      offset-distance: 100%;
                    }
                  }
                `}</style>
              </div>
              <p className="text-center text-sm pb-4">
                Token rewards are now being streamed directly to your wallet.
              </p>
              <div className="flex gap-2">
                {isMiniApp ? (
                  <button
                    onClick={() => {
                      handleClose();
                      setShowMyTokensModal(true);
                    }}
                    className="btn btn-accent flex-1"
                  >
                    Manage Stakes
                  </button>
                ) : (
                  <Link href="/tokens" className="btn btn-accent flex-1">
                    Manage Stakes
                  </Link>
                )}
                <button
                  onClick={handleShare}
                  className="btn btn-outline flex-1"
                >
                  <Image
                    src={FarcasterIcon}
                    alt="Share on Farcaster"
                    width={16}
                    height={16}
                    className="opacity-90"
                  />
                  Share
                </button>
              </div>
              <button onClick={handleClose} className="btn btn-ghost w-full">
                Close
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <Modal isOpen={isOpen} onClose={handleClose}>
          <div className="p-4 space-y-3">
            <h3 className="text-lg font-bold">Stake Successful! 🎉</h3>
            <div className="relative h-24 w-full overflow-hidden rounded-lg">
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 100"
                preserveAspectRatio="xMidYMid meet"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 50 Q100 50 200 50 T400 50"
                  stroke="hsl(220 13% 91%)"
                  strokeWidth="2"
                />
                <g
                  className="reward-particle"
                  style={{ offsetPath: "path('M0 50 Q100 50 200 50 T400 50')" }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.2s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.4s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.6s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.8s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
              </svg>
              <style jsx>{`
                .reward-particle {
                  animation: flow 2s linear infinite;
                }
                @keyframes flow {
                  from {
                    offset-distance: 0%;
                  }
                  to {
                    offset-distance: 100%;
                  }
                }
              `}</style>
            </div>
            <p className="text-center text-sm pb-4">
              Token rewards are now being streamed directly to your wallet.
            </p>
            <div className="flex gap-2">
              {isMiniApp ? (
                <button
                  onClick={() => {
                    handleClose();
                    setShowMyTokensModal(true);
                  }}
                  className="btn btn-accent flex-1"
                >
                  Manage Stakes
                </button>
              ) : (
                <Link href="/tokens" className="btn btn-accent flex-1">
                  Manage Stakes
                </Link>
              )}
              <button onClick={handleShare} className="btn btn-outline flex-1">
                <Image
                  src={FarcasterIcon}
                  alt="Share on Farcaster"
                  width={16}
                  height={16}
                  className="opacity-90"
                />
                Share
              </button>
            </div>
            <button onClick={handleClose} className="btn btn-ghost w-full">
              Close
            </button>
          </div>
        </Modal>
      );
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Stake Tokens</h3>
            {totalStakers && (
              <span className="text-sm opacity-60">
                {totalStakers}{" "}
                {Number(totalStakers) === 1 ? "staker" : "stakers"}
              </span>
            )}
          </div>

          {error && <div className="alert alert-error text-sm">{error}</div>}

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="opacity-60">Amount</span>
              <span className="opacity-60">
                Balance:{" "}
                <span className="font-mono">{formatBalance(balance)}</span>{" "}
                {symbol}
              </span>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.0000"
                  step="0.0001"
                  className="input input-bordered w-full text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-800 transition-all active:scale-95 hover:cursor-pointer"
                  onClick={handleMaxClick}
                >
                  Max
                </button>
              </div>

              {/* Percentage Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[25, 50, 75].map((percentage) => (
                  <button
                    key={percentage}
                    type="button"
                    onClick={() => {
                      const maxAmount = Number(formatUnits(balance, 18));
                      const calculatedAmount = (maxAmount * percentage) / 100;
                      setAmount(calculatedAmount.toFixed(6));
                      setIsMaxAmount(false); // Reset max flag when using percentage
                    }}
                    className="py-1 px-2 text-xs font-medium rounded-md border border-base-300 hover:border-base-400 hover:bg-base-200 transition-colors text-base-content/70 cursor-pointer"
                  >
                    {percentage}%
                  </button>
                ))}
              </div>
              <div className="text-sm opacity-60 bg-base-200 p-3 rounded-lg">
                Note: Staked tokens are locked for {formatLockDuration(lockDuration)} before they can be
                unstaked. Rewards will start streaming immediately.
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={handleStake}
                disabled={
                  isStaking ||
                  !amount ||
                  (isMaxAmount
                    ? balance <= 0n
                    : parseUnits(amount || "0", 18) > balance) ||
                  (isMaxAmount ? false : parseUnits(amount || "0", 18) <= 0n)
                }
              >
                {step === "staking" ? (
                  <LoadingText text="Staking" />
                ) : step === "connecting" ? (
                  <LoadingText text="Connecting to Pool" />
                ) : (
                  "Stake"
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MyTokensModal for mini app */}
      {showMyTokensModal && (
        <MyTokensModal
          isOpen={showMyTokensModal}
          onClose={() => setShowMyTokensModal(false)}
        />
      )}
    </>
  );
}
