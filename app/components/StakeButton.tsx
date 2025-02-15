"use client";

import { useState, useEffect, useCallback } from "react";
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

const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";

const gdaABI = [
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "member", type: "address" },
    ],
    name: "isMemberConnected",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "userData", type: "bytes" },
    ],
    name: "connectPool",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL || "https://base.llamarpc.com"
  ),
});

const toHex = (address: string) => address as `0x${string}`;

interface StakeButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  totalStakers?: string;
}

export function StakeButton({
  tokenAddress,
  stakingAddress,
  stakingPoolAddress,
  disabled,
  className,
  symbol,
  totalStakers,
}: StakeButtonProps) {
  const { user } = usePrivy();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [balance, setBalance] = useState<bigint>(0n);

  const fetchBalance = useCallback(async () => {
    if (!user?.wallet?.address) return;
    const walletAddress = user.wallet.address;

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
      setBalance(0n);
      // Optionally add user-facing error handling here
      // toast.error("Failed to fetch balance. Please try again later.");
    }
  }, [user?.wallet?.address, tokenAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleStake = async (amount: bigint) => {
    if (!window.ethereum || !user?.wallet?.address) return;
    const walletAddress = user.wallet.address;

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
        args: [toHex(stakingAddress), amount],
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Then stake them
      const stakeTx = await walletClient.writeContract({
        address: toHex(stakingAddress),
        abi: stakingAbi,
        functionName: "stake",
        args: [toHex(walletAddress), amount],
      });

      await publicClient.waitForTransactionReceipt({ hash: stakeTx });

      // Finally connect to the GDA pool
      const connected = await publicClient.readContract({
        address: toHex(GDA_FORWARDER),
        abi: gdaABI,
        functionName: "isMemberConnected",
        args: [toHex(stakingPoolAddress), toHex(walletAddress)],
      });

      if (!connected) {
        const userData = "0x" as const;
        const connectTx = await walletClient.writeContract({
          address: toHex(GDA_FORWARDER),
          abi: gdaABI,
          functionName: "connectPool",
          args: [toHex(stakingPoolAddress), userData],
        });

        await publicClient.waitForTransactionReceipt({ hash: connectTx });
      }

      // Refresh balance after successful stake
      await fetchBalance();
    } catch (error) {
      console.error("Staking error:", error);
      throw error;
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
