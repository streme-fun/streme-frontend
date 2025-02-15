"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { UnstakeModal } from "./UnstakeModal";

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
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL || "https://base.llamarpc.com"
  ),
});

const toHex = (address: string) => address as `0x${string}`;

interface UnstakeButtonProps {
  stakingAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
}

export function UnstakeButton({
  stakingAddress,
  disabled,
  className,
  symbol,
}: UnstakeButtonProps) {
  const { user } = usePrivy();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);

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

  useEffect(() => {
    fetchStakedBalance();
  }, [fetchStakedBalance]);

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
    } catch (error) {
      console.error("Unstaking error:", error);
      throw error;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled || stakedBalance <= 0n}
        className={className}
      >
        Unstake
      </button>

      <UnstakeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        balance={stakedBalance}
        symbol={symbol}
        onUnstake={handleUnstake}
      />
    </>
  );
}
