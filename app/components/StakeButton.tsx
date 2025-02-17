"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { StakeModal } from "./StakeModal";
import { Interface } from "@ethersproject/abi";

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
  const { wallets } = useWallets();
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
    if (!user?.wallet?.address) {
      throw new Error("Wallet not connected");
    }

    const walletAddress = user.wallet.address;
    const wallet = wallets.find((w) => w.address === walletAddress);

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    try {
      const provider = await wallet.getEthereumProvider();

      // Add this section to switch network
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }], // 0x2105 is hex for 8453 (Base)
      });

      // First approve the tokens
      const approveIface = new Interface([
        "function approve(address spender, uint256 amount) external returns (bool)",
      ]);
      const approveData = approveIface.encodeFunctionData("approve", [
        toHex(stakingAddress),
        amount,
      ]);

      const approveTx = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: toHex(tokenAddress),
            from: walletAddress,
            data: approveData,
          },
        ],
      });

      // Wait for approval confirmation
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTx as `0x${string}`,
      });

      if (!approveReceipt.status) {
        throw new Error("Approval transaction failed");
      }

      // Then stake them
      const stakeIface = new Interface([
        "function stake(address to, uint256 amount) external",
      ]);
      const stakeData = stakeIface.encodeFunctionData("stake", [
        toHex(walletAddress),
        amount,
      ]);

      const stakeTx = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: toHex(stakingAddress),
            from: walletAddress,
            data: stakeData,
          },
        ],
      });

      const stakeReceipt = await publicClient.waitForTransactionReceipt({
        hash: stakeTx as `0x${string}`,
      });

      if (!stakeReceipt.status) {
        throw new Error("Stake transaction failed");
      }

      // Check GDA pool connection
      const connected = await publicClient.readContract({
        address: toHex(GDA_FORWARDER),
        abi: gdaABI,
        functionName: "isMemberConnected",
        args: [toHex(stakingPoolAddress), toHex(walletAddress)],
      });

      if (!connected) {
        const gdaIface = new Interface([
          "function connectPool(address pool, bytes calldata userData) external returns (bool)",
        ]);
        const connectData = gdaIface.encodeFunctionData("connectPool", [
          toHex(stakingPoolAddress),
          "0x",
        ]);

        const connectTx = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(GDA_FORWARDER),
              from: walletAddress,
              data: connectData,
            },
          ],
        });

        const connectReceipt = await publicClient.waitForTransactionReceipt({
          hash: connectTx as `0x${string}`,
        });

        if (!connectReceipt.status) {
          throw new Error("Pool connection failed");
        }
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
