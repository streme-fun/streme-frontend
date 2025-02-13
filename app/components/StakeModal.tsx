"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
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
}

const LoadingText = ({ text }: { text: string }) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span>
      {text}
      {dots}
    </span>
  );
};

const formatBalance = (value: bigint, decimals: number = 18) => {
  return parseFloat(formatUnits(value, decimals)).toFixed(4);
};

const REWARDS_PER_SECOND = 634.1958449;

const AnimatedNumber = ({
  value,
  symbol,
}: {
  value: string;
  symbol: string;
}) => {
  const [current, setCurrent] = useState(0);
  const target = parseFloat(value);

  useEffect(() => {
    // Reset to 0 when value changes
    setCurrent(0);

    // Update every 50ms with the rewards rate
    const interval = setInterval(() => {
      setCurrent((prev) => {
        // REWARDS_PER_SECOND / 20 because we update every 50ms (1000ms/50ms = 20)
        const increment = REWARDS_PER_SECOND / 20;
        return prev + increment > target ? target : prev + increment;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [target]);

  return (
    <div className="font-mono text-2xl text-center">
      {Math.floor(current).toLocaleString()}{" "}
      <span className="text-base opacity-60">{symbol}</span>
    </div>
  );
};

export function StakeModal({
  isOpen,
  onClose,
  balance,
  symbol,
  onStake,
  totalStakers,
}: StakeModalProps) {
  const [amount, setAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState<
    "idle" | "approving" | "staking" | "connecting"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const { user } = usePrivy();

  const handleStake = async () => {
    setError(null);
    try {
      setIsStaking(true);
      setStep("approving");
      await onStake(parseUnits(amount, 18));
      setStep("staking");
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStep("connecting");
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsSuccess(true);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("User rejected")) {
          setError("Transaction cancelled");
        } else {
          setError("Failed to stake tokens. Please try again.");
        }
      } else {
        setError("An unexpected error occurred");
      }
      console.error("Staking error:", error);
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
          <AnimatedNumber value={amount} symbol={symbol} />

          <p className="text-center">
            Token rewards are now being streamed directly to your wallet.
          </p>
          <a
            href={`https://explorer.superfluid.finance/base-mainnet/accounts/${user?.wallet?.address}?tab=pools`}
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
                className="input input-bordered w-full"
              />
              <button
                className="btn btn-xs btn-ghost absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setAmount(formatUnits(balance, 18))}
              >
                Max
              </button>
            </div>
            <button
              className={`btn w-full relative overflow-hidden
                before:absolute before:inset-0 before:bg-gradient-to-r 
                before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f]
                before:opacity-30
                hover:before:opacity-40
                border-[#ffa647]/30
                hover:border-[#ffa647]/50
                shadow-[0_0_5px_rgba(255,166,71,0.3)]
                hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]
                disabled:before:opacity-0
                disabled:hover:before:opacity-0
                disabled:border-opacity-0
                disabled:shadow-none
                disabled:hover:shadow-none`}
              onClick={handleStake}
              disabled={
                isStaking ||
                !amount ||
                parseUnits(amount || "0", 18) > balance ||
                parseUnits(amount || "0", 18) <= 0n
              }
            >
              {step === "approving" ? (
                <LoadingText text="Approving" />
              ) : step === "staking" ? (
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
