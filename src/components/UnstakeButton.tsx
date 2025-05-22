"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { UnstakeModal } from "./UnstakeModal";
import { publicClient } from "@/src/lib/viemClient";
import { Interface } from "@ethersproject/abi";
import { sdk } from "@farcaster/frame-sdk";
import { toast } from "sonner";

const stakingAbiEthers = [
  "function unstake(address to, uint256 amount)",
  "function depositTimestamps(address account) view returns (uint256)",
];

const stakingAbiViem = [
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
  userStakedBalance: bigint;
  disabled?: boolean;
  className?: string;
  symbol: string;
  onSuccess?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
}

export function UnstakeButton({
  stakingAddress,
  userStakedBalance,
  disabled,
  className,
  symbol,
  onSuccess,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
}: UnstakeButtonProps) {
  const { user } = usePrivy();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unlockTime, setUnlockTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!user?.wallet?.address;
  const effectiveAddress = isMiniApp ? farcasterAddress : user?.wallet?.address;

  const fetchUnlockTime = useCallback(async () => {
    if (!effectiveAddress || !effectiveIsConnected) return;
    try {
      const timestamp = await publicClient.readContract({
        address: toHex(stakingAddress),
        abi: stakingAbiViem,
        functionName: "depositTimestamps",
        args: [toHex(effectiveAddress)],
      });

      const unlockTimeStamp = Number(timestamp) + 86400; // 24 hours in seconds
      setUnlockTime(unlockTimeStamp);
    } catch (error) {
      console.error("Error fetching unlock time:", error);
      toast.error("Could not fetch unlock time.");
    }
  }, [effectiveAddress, effectiveIsConnected, stakingAddress]);

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
    if (effectiveIsConnected) {
      fetchUnlockTime();
    }
  }, [fetchUnlockTime, effectiveIsConnected]);

  const isLocked = unlockTime
    ? Math.floor(Date.now() / 1000) < unlockTime
    : false;

  const handleUnstake = async (amount: bigint) => {
    if (!effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected or address missing.");
      throw new Error("Wallet not connected or address missing.");
    }
    setIsLoading(true);
    const toastId = toast.loading("Preparing unstake transaction...");

    try {
      let unstakeTxHash: `0x${string}` | undefined;

      if (isMiniApp) {
        const ethProvider = sdk.wallet.ethProvider;
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available.");
        }

        toast.info("Requesting unstake...", { id: toastId });
        const unstakeIface = new Interface(stakingAbiEthers);
        const unstakeData = unstakeIface.encodeFunctionData("unstake", [
          toHex(effectiveAddress!),
          amount,
        ]);

        unstakeTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(stakingAddress),
              from: toHex(effectiveAddress!),
              data: toHex(unstakeData),
            },
          ],
        });

        if (!unstakeTxHash) {
          throw new Error(
            "Unstake transaction hash not received. User might have cancelled."
          );
        }
        toast.loading("Waiting for unstake confirmation...", { id: toastId });
        const unstakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: unstakeTxHash,
        });
        if (unstakeReceipt.status !== "success") {
          throw new Error("Unstake transaction failed.");
        }
        toast.success("Unstaking successful!", { id: toastId });
      } else {
        // Privy Path
        if (!window.ethereum || !user?.wallet?.address) {
          throw new Error(
            "Privy wallet not connected or Ethereum provider missing."
          );
        }
        const walletAddress = user.wallet.address; // Define walletAddress for Privy path

        const walletClient = createWalletClient({
          // Define walletClient for Privy path
          chain: base,
          transport: custom(window.ethereum),
          account: toHex(walletAddress),
        });

        await walletClient.request({
          // Switch chain if necessary
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${base.id.toString(16)}` }],
        });

        toast.info("Requesting unstake...", { id: toastId });
        // writeContract returns the hash directly in Viem
        unstakeTxHash = await walletClient.writeContract({
          address: toHex(stakingAddress),
          abi: stakingAbiViem, // Use Viem ABI for writeContract
          functionName: "unstake",
          args: [toHex(walletAddress), amount],
        });

        if (!unstakeTxHash) {
          throw new Error(
            "Unstake transaction hash not received (Privy). User might have cancelled."
          );
        }
        toast.loading("Waiting for unstake confirmation...", { id: toastId });
        // Correctly wait for transaction receipt
        const unstakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: unstakeTxHash,
        });
        if (!unstakeReceipt.status || unstakeReceipt.status !== "success") {
          throw new Error("Unstake transaction failed (Privy).");
        }
        toast.success("Unstaking successful!", { id: toastId });
      }

      onSuccess?.();
      fetchUnlockTime();
      setIsModalOpen(false);
    } catch (error: unknown) {
      console.error("UnstakeButton caught error:", error);
      let message = "Unstake operation failed.";
      let errorDetails = "";
      if (typeof error === "object" && error !== null) {
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error("UnstakeButton error details (stringified):", errorDetails);

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
        } else if (
          errorDetails.includes("UserRejected") ||
          errorDetails.includes("User denied") ||
          errorDetails.includes("rejected by user")
        ) {
          message = "Transaction rejected by user.";
        }
      }
      toast.error(message, { id: toastId });
      // Ensure the modal can handle this error correctly
      // If UnstakeModal's onUnstake expects a void promise, this is fine.
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => !isLoading && setIsModalOpen(true)}
        disabled={disabled || userStakedBalance <= 0n || isLocked || isLoading}
        className={className}
        title={timeLeft ? `Unlocks in ${timeLeft}` : undefined}
      >
        {isLoading
          ? "Processing..."
          : timeLeft
          ? `Unlock in ${timeLeft}`
          : "Unstake"}
      </button>

      <UnstakeModal
        isOpen={isModalOpen}
        onClose={() => !isLoading && setIsModalOpen(false)}
        balance={userStakedBalance}
        symbol={symbol}
        onUnstake={handleUnstake} // handleUnstake now correctly matches Promise<void>
        onSuccess={onSuccess}
      />
    </>
  );
}
