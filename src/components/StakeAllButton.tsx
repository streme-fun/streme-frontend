"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { toast } from "sonner";
import { sdk } from "@farcaster/frame-sdk";

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

const erc20ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const toHex = (address: string) => address as `0x${string}`;

// Add constant for unlimited allowance
const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

interface StakeAllButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  onSuccess?: () => void;
  onPoolConnect?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
}

export function StakeAllButton({
  tokenAddress,
  stakingAddress,
  stakingPoolAddress,
  disabled,
  className,
  symbol,
  onSuccess,
  onPoolConnect,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
}: StakeAllButtonProps) {
  const { wallets } = useWallets();
  const { address: wagmiAddress } = useAccount();
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!wagmiAddress;
  const effectiveAddress = isMiniApp ? farcasterAddress : wagmiAddress;

  const fetchBalance = useCallback(async () => {
    if (!effectiveAddress || !effectiveIsConnected) {
      setBalance(0n);
      return;
    }

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
        args: [toHex(effectiveAddress)],
      });
      setBalance(bal);
    } catch (error) {
      console.error("Error fetching token balance:", error);
      setBalance(0n);
    }
  }, [effectiveAddress, effectiveIsConnected, tokenAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const checkAllowance = async () => {
    if (!effectiveAddress || !effectiveIsConnected) return 0n;
    try {
      const allowance = await publicClient.readContract({
        address: toHex(tokenAddress),
        abi: erc20ABI,
        functionName: "allowance",
        args: [toHex(effectiveAddress!), toHex(stakingAddress)],
      });
      return allowance;
    } catch (error) {
      console.error("Error checking allowance:", error);
      return 0n;
    }
  };

  const handleStakeAll = async () => {
    if (!effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected or address missing");
      return;
    }

    if (balance === 0n) {
      toast.error("No tokens available to stake");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Preparing stake all transaction...");

    try {
      let approveTxHash: `0x${string}` | undefined;
      let stakeTxHash: `0x${string}` | undefined;
      let connectTxHash: `0x${string}` | undefined;

      if (isMiniApp) {
        const ethProvider = sdk.wallet.ethProvider;
        if (!ethProvider)
          throw new Error("Farcaster Ethereum provider not available.");

        const currentAllowance = await checkAllowance();
        if (currentAllowance < balance) {
          toast.info(
            "Requesting unlimited approval for future transactions...",
            { id: toastId }
          );
          const approveIface = new Interface([
            "function approve(address spender, uint256 amount) external returns (bool)",
          ]);
          const approveData = approveIface.encodeFunctionData("approve", [
            toHex(stakingAddress),
            MAX_UINT256,
          ]);
          approveTxHash = await ethProvider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(tokenAddress),
                from: toHex(effectiveAddress!),
                data: toHex(approveData),
              },
            ],
          });
          if (!approveTxHash)
            throw new Error(
              "Approval transaction hash not received. User might have cancelled."
            );
          toast.loading("Waiting for approval confirmation...", {
            id: toastId,
          });
          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveTxHash,
          });
          if (approveReceipt.status !== "success")
            throw new Error("Approval transaction failed");
          toast.success(
            "Approval successful! You won't need to approve again.",
            { id: toastId }
          );
        } else {
          toast.info("Sufficient allowance found, skipping approval...", {
            id: toastId,
          });
        }

        toast.loading("Requesting stake...", { id: toastId });
        const stakeIface = new Interface([
          "function stake(address to, uint256 amount) external",
        ]);
        const stakeData = stakeIface.encodeFunctionData("stake", [
          toHex(effectiveAddress!),
          balance,
        ]);
        stakeTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(stakingAddress),
              from: toHex(effectiveAddress!),
              data: toHex(stakeData),
            },
          ],
        });
        if (!stakeTxHash)
          throw new Error(
            "Stake transaction hash not received. User might have cancelled."
          );
        toast.loading("Waiting for stake confirmation...", { id: toastId });
        const stakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: stakeTxHash,
        });
        if (stakeReceipt.status !== "success")
          throw new Error("Stake transaction failed");
        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(effectiveAddress!)],
          });
          if (!connected) {
            toast.loading("Connecting to reward pool...", { id: toastId });
            const gdaIface = new Interface([
              "function connectPool(address pool, bytes calldata userData) external returns (bool)",
            ]);
            const connectData = gdaIface.encodeFunctionData("connectPool", [
              toHex(stakingPoolAddress),
              "0x",
            ]);
            connectTxHash = await ethProvider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  to: toHex(GDA_FORWARDER),
                  from: toHex(effectiveAddress!),
                  data: toHex(connectData),
                },
              ],
            });
            if (!connectTxHash)
              throw new Error("Pool connection transaction hash not received.");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });
            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      } else {
        // Wagmi Path
        if (!wagmiAddress) throw new Error("Wagmi wallet not connected.");
        const walletAddress = wagmiAddress;
        const wallet = wallets.find((w) => w.address === walletAddress);
        if (!wallet) throw new Error("Wagmi Wallet not found");
        const provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        const currentAllowance = await checkAllowance();
        if (currentAllowance < balance) {
          toast.info(
            "Requesting unlimited approval for future transactions...",
            { id: toastId }
          );
          const approveIface = new Interface([
            "function approve(address spender, uint256 amount) external returns (bool)",
          ]);
          const approveData = approveIface.encodeFunctionData("approve", [
            toHex(stakingAddress),
            MAX_UINT256,
          ]);
          const approveTxResult = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(tokenAddress),
                from: toHex(walletAddress),
                data: toHex(approveData),
              },
            ],
          });
          approveTxHash = approveTxResult as `0x${string}`;
          if (!approveTxHash)
            throw new Error(
              "Approval transaction hash not received (Wagmi). User might have cancelled."
            );
          toast.loading("Waiting for approval confirmation...", {
            id: toastId,
          });
          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveTxHash,
          });
          if (!approveReceipt.status || approveReceipt.status !== "success")
            throw new Error("Approval transaction failed (Wagmi)");
          toast.success(
            "Approval successful! You won't need to approve again.",
            { id: toastId }
          );
        } else {
          toast.info("Sufficient allowance found, skipping approval...", {
            id: toastId,
          });
        }

        toast.loading("Requesting stake...", { id: toastId });
        const stakeIface = new Interface([
          "function stake(address to, uint256 amount) external",
        ]);
        const stakeData = stakeIface.encodeFunctionData("stake", [
          toHex(walletAddress),
          balance,
        ]);
        const estimatedGas = await publicClient.estimateGas({
          account: walletAddress as `0x${string}`,
          to: toHex(stakingAddress),
          data: stakeData as `0x${string}`,
        });
        const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.5));
        const gas = `0x${gasLimit.toString(16)}` as `0x${string}`;
        const stakeTxResult = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(stakingAddress),
              from: toHex(walletAddress),
              data: toHex(stakeData),
              gas: gas,
            },
          ],
        });
        stakeTxHash = stakeTxResult as `0x${string}`;
        if (!stakeTxHash)
          throw new Error(
            "Stake transaction hash not received (Wagmi). User might have cancelled."
          );
        toast.loading("Waiting for stake confirmation...", { id: toastId });
        const stakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: stakeTxHash,
        });
        if (!stakeReceipt.status || stakeReceipt.status !== "success")
          throw new Error("Stake transaction failed (Wagmi)");
        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(walletAddress!)],
          });
          if (!connected) {
            toast.loading("Connecting to reward pool...", { id: toastId });
            const gdaIface = new Interface([
              "function connectPool(address pool, bytes calldata userData) external returns (bool)",
            ]);
            const connectData = gdaIface.encodeFunctionData("connectPool", [
              toHex(stakingPoolAddress),
              "0x",
            ]);
            const connectTxResult = await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  to: toHex(GDA_FORWARDER),
                  from: toHex(walletAddress!),
                  data: toHex(connectData),
                },
              ],
            });
            connectTxHash = connectTxResult as `0x${string}`;
            if (!connectTxHash)
              throw new Error("Pool conn tx hash not received (Wagmi).");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });
            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      }

      // Success - refresh balance and trigger callbacks
      await fetchBalance();
      onSuccess?.();
      toast.success(`Successfully staked all ${symbol} tokens!`, {
        id: toastId,
      });
    } catch (error: unknown) {
      console.error("StakeAllButton caught error:", error);
      let message = "Stake all operation failed.";

      if (typeof error === "object" && error !== null) {
        if (
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ) {
          const errorMessage = (error as { message: string }).message;
          if (
            errorMessage.includes("User rejected") ||
            errorMessage.includes("cancelled") ||
            errorMessage.includes("hash not received")
          ) {
            message = "Transaction rejected or cancelled.";
          } else {
            message = errorMessage.substring(0, 100);
          }
        } else if (
          "shortMessage" in error &&
          typeof (error as { shortMessage: unknown }).shortMessage === "string"
        ) {
          message = (error as { shortMessage: string }).shortMessage;
        }
      }

      toast.error(message, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show button if no balance
  if (balance === 0n) {
    return null;
  }

  return (
    <button
      onClick={handleStakeAll}
      disabled={disabled || isLoading || balance === 0n}
      className={className}
    >
      {isLoading ? "Processing..." : "Stake All"}
    </button>
  );
}
