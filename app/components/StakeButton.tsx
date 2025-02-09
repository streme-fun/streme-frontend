"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { StakeModal } from "./StakeModal";

const superAbi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const stakingAbi = [
  {
    name: "stake",
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
  transport: http(),
});

const toHex = (address: string) => address as `0x${string}`;

interface StakeButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  stakingPool: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  totalStakers?: string;
}

export function StakeButton({
  tokenAddress,
  stakingAddress,
  stakingPool,
  disabled,
  className,
  symbol,
  totalStakers,
}: StakeButtonProps) {
  const { user } = usePrivy();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [balance, setBalance] = useState<bigint>(0n);

  useEffect(() => {
    if (!user?.wallet?.address) return;
    const walletAddress = user.wallet.address;

    const fetchBalance = async () => {
      try {
        const bal = await publicClient.readContract({
          address: toHex(tokenAddress),
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
        setBalance(bal);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    fetchBalance();
  }, [user?.wallet?.address, tokenAddress]);

  const handleStake = async (amount: bigint) => {
    if (!window.ethereum || !user?.wallet?.address) return;
    const walletAddress = user.wallet.address; // Store in a const to satisfy TypeScript

    const walletClient = createWalletClient({
      chain: base,
      transport: custom(window.ethereum),
      account: toHex(walletAddress),
    });

    try {
      // First approve the tokens
      const approveTx = await walletClient.writeContract({
        address: toHex(tokenAddress),
        abi: superAbi,
        functionName: "approve",
        args: [toHex(stakingPool), amount],
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Then stake them
      const stakeTx = await walletClient.writeContract({
        address: toHex(stakingPool),
        abi: stakingAbi,
        functionName: "stake",
        args: [toHex(walletAddress), amount],
      });

      await publicClient.waitForTransactionReceipt({ hash: stakeTx });
    } catch (error) {
      console.error("Staking error:", error);
      throw error; // Re-throw to be handled by the modal
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className={className}
      >
        Stake
      </button>

      <StakeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tokenAddress={tokenAddress}
        stakingAddress={stakingAddress}
        balance={balance}
        symbol={symbol}
        totalStakers={totalStakers}
        onStake={handleStake}
      />
    </>
  );
}
