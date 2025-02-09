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
  const [step, setStep] = useState<"idle" | "approving" | "staking">("idle");
  const { user } = usePrivy();

  const handleStake = async () => {
    try {
      setIsStaking(true);
      setStep("approving");
      await onStake(parseUnits(amount, 18));
      setStep("staking");
      setIsSuccess(true);
    } catch (error) {
      console.error("Staking failed:", error);
    } finally {
      setIsStaking(false);
      setStep("idle");
    }
  };

  const handleClose = () => {
    setAmount("");
    setIsSuccess(false);
    onClose();
  };

  if (isSuccess) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold">Stake Successful! 🎉</h3>
          <p>Your tokens are now earning rewards.</p>
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
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="opacity-60">Amount</span>
            <span className="opacity-60">
              Balance: {formatBalance(balance)} {symbol}
            </span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0000"
            step="0.0001"
            className="input input-bordered w-full"
          />
          <button
            className="btn btn-xs btn-ghost mt-2"
            onClick={() => setAmount(formatUnits(balance, 18))}
          >
            Max
          </button>
        </div>
        <button
          className={`btn w-full relative overflow-hidden
            before:absolute before:inset-0 before:bg-gradient-to-r 
            before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f]
            before:opacity-20
            hover:before:opacity-30
            hover:border-[#ffa647]/50
            hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]
            disabled:before:opacity-0
            disabled:hover:before:opacity-0
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
          ) : (
            "Stake"
          )}
        </button>
      </div>
    </Modal>
  );
}
