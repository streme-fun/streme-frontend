"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { Modal } from "./Modal";

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

export function StakeModal({
  isOpen,
  onClose,
  balance,
  symbol,
  onStake,
  totalStakers,
  onSuccess,
}: StakeModalProps) {
  const [amount, setAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState<"idle" | "staking" | "connecting">("idle");
  const [error, setError] = useState<string | null>(null);
  const { address: wagmiAddress } = useAccount();

  const handleStake = async () => {
    setError(null);
    setIsStaking(true);
    setStep("staking");

    try {
      await onStake(parseUnits(amount, 18));
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
    onClose();
  };

  if (isSuccess) {
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
          <a
            href={`https://explorer.superfluid.finance/base-mainnet/accounts/${wagmiAddress}?tab=pools`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-accent w-full"
          >
            Manage Stakes
          </a>
          <button onClick={handleClose} className="btn btn-ghost w-full">
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Stake Tokens</h3>
          {totalStakers && (
            <span className="text-sm opacity-60">
              {totalStakers} {Number(totalStakers) === 1 ? "staker" : "stakers"}
            </span>
          )}
        </div>

        {error && <div className="alert alert-error text-sm">{error}</div>}

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="opacity-60">Amount</span>
            <span className="opacity-60">
              Balance: {formatBalance(balance)} {symbol}
            </span>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0000"
                step="0.0001"
                className="input input-bordered w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-800 transition-all active:scale-95 hover:cursor-pointer"
                onClick={() => setAmount(formatUnits(balance, 18))}
              >
                Max
              </button>
            </div>
            <div className="text-sm opacity-60 bg-base-200 p-3 rounded-lg">
              Note: Staked tokens are locked for 24 hours before they can be
              unstaked. Rewards will start streaming immediately.
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={handleStake}
              disabled={
                isStaking ||
                !amount ||
                parseUnits(amount || "0", 18) > balance ||
                parseUnits(amount || "0", 18) <= 0n
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
  );
}
