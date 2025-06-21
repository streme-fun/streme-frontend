"use client";

import { useState, useEffect } from "react";
import { formatUnits, parseUnits } from "viem";
import { Modal } from "./Modal";

interface UnstakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: bigint;
  symbol: string;
  onUnstake: (amount: bigint) => Promise<void>;
  onSuccess?: () => void;
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

export function UnstakeModal({
  isOpen,
  onClose,
  balance,
  symbol,
  onUnstake,
  onSuccess,
}: UnstakeModalProps) {
  const [amount, setAmount] = useState("");
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnstake = async () => {
    setError(null);
    try {
      setIsUnstaking(true);
      await onUnstake(parseUnits(amount, 18));
      setIsSuccess(true);
      onSuccess?.();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("User rejected")) {
          setError("Transaction cancelled");
        } else {
          setError("Failed to unstake tokens. Please try again.");
        }
      } else {
        setError("An unexpected error occurred");
      }
      console.error("Unstaking error:", error);
    } finally {
      setIsUnstaking(false);
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
          <h3 className="text-lg font-bold">Unstake Successful! 🎉</h3>
          <p className="text-center">
            Your tokens have been successfully unstaked.
          </p>
          <button onClick={handleClose} className="btn btn-primary w-full">
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-bold">Unstake Tokens</h3>

        {error && <div className="alert alert-error text-sm">{error}</div>}

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="opacity-60">Amount</span>
            <span className="opacity-60">
              Staked: {formatBalance(balance)} st{symbol}
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
                className="input input-bordered w-full text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 hover:text-gray-800 transition-all active:scale-95 hover:cursor-pointer"
                onClick={() => setAmount(formatUnits(balance, 18))}
              >
                Max
              </button>
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={handleUnstake}
              disabled={
                isUnstaking ||
                !amount ||
                parseUnits(amount || "0", 18) > balance ||
                parseUnits(amount || "0", 18) <= 0n
              }
            >
              {isUnstaking ? <LoadingText text="Unstaking" /> : "Unstake"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
