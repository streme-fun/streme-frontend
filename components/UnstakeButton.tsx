"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { UnstakeModal } from "./UnstakeModal";
import { publicClient } from "@/lib/viemClient";

const stakingAbi = [
  {
    name: "unstake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "depositTimestamps",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const toHex = (address: string) => address as `0x${string}`;

interface UnstakeButtonProps {
  stakingAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  onSuccess?: () => void;
}

export function UnstakeButton({
  stakingAddress,
  disabled,
  className,
  symbol,
  onSuccess,
}: UnstakeButtonProps) {
  const { user } = usePrivy();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);
  const [unlockTime, setUnlockTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const fetchStakedBalance = useCallback(async () => {
    if (!user?.wallet?.address) return;
    const walletAddress = user.wallet.address;

    try {
      const bal = await publicClient.readContract({
        address: toHex(stakingAddress),
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
        args: [toHex(walletAddress)],
      });
      setStakedBalance(bal);
    } catch (error) {
      console.error("Error fetching staked balance:", error);
      setStakedBalance(0n);
    }
  }, [user?.wallet?.address, stakingAddress]);

  const fetchUnlockTime = useCallback(async () => {
    if (!user?.wallet?.address) return;
    try {
      const timestamp = await publicClient.readContract({
        address: toHex(stakingAddress),
        abi: stakingAbi,
        functionName: "depositTimestamps",
        args: [toHex(user.wallet.address)],
      });

      const unlockTimeStamp = Number(timestamp) + 86400; // 24 hours in seconds
      setUnlockTime(unlockTimeStamp);
    } catch (error) {
      console.error("Error fetching unlock time:", error);
    }
  }, [user?.wallet?.address, stakingAddress]);

  // Update timer every second
  useEffect(() => {
    if (!unlockTime) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const secondsLeft = unlockTime - now;

      if (secondsLeft <= 0) {
        setTimeLeft("");
        return;
      }

      const hours = Math.floor(secondsLeft / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);
      const seconds = secondsLeft % 60;

      setTimeLeft(
        `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
          .toString()
          .padStart(2, "0")}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [unlockTime]);

  useEffect(() => {
    fetchStakedBalance();
    fetchUnlockTime();
  }, [fetchStakedBalance, fetchUnlockTime]);

  const isLocked = unlockTime
    ? Math.floor(Date.now() / 1000) < unlockTime
    : false;

  const handleUnstake = async (amount: bigint) => {
    if (!window.ethereum || !user?.wallet?.address) return;
    const walletAddress = user.wallet.address;

    const walletClient = createWalletClient({
      chain: base,
      transport: custom(window.ethereum),
      account: toHex(walletAddress),
    });

    try {
      const unstakeTx = await walletClient.writeContract({
        address: toHex(stakingAddress),
        abi: stakingAbi,
        functionName: "unstake",
        args: [toHex(walletAddress), amount],
      });

      await publicClient.waitForTransactionReceipt({ hash: unstakeTx });

      // Refresh balance after successful unstake
      await fetchStakedBalance();
      onSuccess?.();
    } catch (error) {
      console.error("Unstaking error:", error);
      throw error;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled || stakedBalance <= 0n || isLocked}
        className={className}
        title={timeLeft ? `Unlocks in ${timeLeft}` : undefined}
      >
        {timeLeft ? `Unlock in ${timeLeft}` : "Unstake"}
      </button>

      <UnstakeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        balance={stakedBalance}
        symbol={symbol}
        onUnstake={handleUnstake}
        onSuccess={onSuccess}
      />
    </>
  );
}
