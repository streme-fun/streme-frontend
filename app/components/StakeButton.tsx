"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { parseEther, encodeFunctionData } from "viem";

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

const gdaAbi = [
  {
    name: "isMemberConnected",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "pool", type: "address" },
      { name: "member", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "connectPool",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "userData", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export function StakeButton({
  tokenAddress,
  stakingAddress,
  stakingPool,
  disabled,
  className,
}: {
  tokenAddress: string;
  stakingAddress: string;
  stakingPool: string;
  disabled: boolean;
  className?: string;
}) {
  const { wallets } = useWallets();
  const { user } = usePrivy();
  const address = user?.wallet?.address;

  const handleStake = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address || !wallets?.[0]) return;

    try {
      const provider = await wallets[0].getEthereumProvider();
      const amount = parseEther("1000");

      // First check if already connected to pool
      const isConnected = await provider.request({
        method: "eth_call",
        params: [
          {
            to: stakingPool as `0x${string}`,
            data: encodeFunctionData({
              abi: gdaAbi,
              functionName: "isMemberConnected",
              args: [stakingPool as `0x${string}`, address as `0x${string}`],
            }),
          },
          "latest",
        ],
      });

      // First approve
      await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: tokenAddress as `0x${string}`,
            data: encodeFunctionData({
              abi: superAbi,
              functionName: "approve",
              args: [stakingAddress as `0x${string}`, amount],
            }),
          },
        ],
      });

      // Then stake
      await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: stakingAddress as `0x${string}`,
            data: encodeFunctionData({
              abi: stakingAbi,
              functionName: "stake",
              args: [address as `0x${string}`, amount],
            }),
          },
        ],
      });

      // Connect pool if not already connected
      if (!isConnected) {
        await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: stakingPool as `0x${string}`,
              data: encodeFunctionData({
                abi: gdaAbi,
                functionName: "connectPool",
                args: [stakingPool as `0x${string}`, "0x"],
              }),
            },
          ],
        });
      }
    } catch (error) {
      console.error("Staking error:", error);
    }
  };

  return (
    <button onClick={handleStake} disabled={disabled} className={className}>
      <span className="relative">Stake</span>
    </button>
  );
}
