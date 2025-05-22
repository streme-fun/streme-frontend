"use client";

import { useState, useEffect } from "react";
// import { usePrivy, useWallets } from "@privy-io/react-auth"; // Replaced
import { toast } from "sonner";
// import { Interface } from "@ethersproject/abi"; // Removed as unused
import { LP_FACTORY_ADDRESS, LP_FACTORY_ABI } from "@/src/lib/contracts"; // Assuming LP_FACTORY_ABI includes claimRewards
// import { publicClient } from "@/src/lib/viemClient"; // Removed as unused
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic"; // Added
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"; // Added Wagmi hooks

interface ClaimFeesButtonProps {
  tokenAddress: string;
  creatorAddress?: string; // This prop might still be relevant for UI logic, but tx sends to contract logic
  className?: string;
}

export function ClaimFeesButton({
  tokenAddress,
  // creatorAddress, // Not directly used in transaction if contract handles recipient
  className = "btn btn-secondary w-full",
}: ClaimFeesButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    address: connectedAddress, // From useAppFrameLogic
    isConnected,
    // We might need chainId from wagmi's useAccount or useChainId if LP_FACTORY_ADDRESS is chain-specific and not on `base`
  } = useAppFrameLogic();

  const {
    writeContractAsync,
    data: hash,
    isPending: isClaimingFees, // Use wagmi's pending state
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmationError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const handleClaimFees = async () => {
    if (!isConnected || !connectedAddress) {
      toast.error("Please connect your wallet.");
      return;
    }

    const toastId = toast.loading("Preparing transaction...");

    try {
      await writeContractAsync({
        address: LP_FACTORY_ADDRESS,
        abi: LP_FACTORY_ABI,
        functionName: "claimRewards",
        args: [tokenAddress as `0x${string}`],
      });

      toast.loading("Confirming transaction...", { id: toastId });
    } catch (error: unknown) {
      console.error("Error claiming fees (writeContractAsync):", error);
      // Attempt to get a more specific message, default to generic
      let message = "Failed to send transaction";
      if (error instanceof Error) {
        if (error.message.includes("User rejected the request")) {
          message = "Transaction rejected";
        } else {
          message = error.message; // Use the full message from the error object
        }
      }
      toast.error(message, { id: toastId });
    }
  };

  // Effect to handle transaction confirmation and success/error UI
  useEffect(() => {
    if (isConfirmed) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      toast.success(
        <div className="flex flex-col gap-2">
          <div>Successfully claimed LP fees!</div>
          <a
            href={`https://basescan.org/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-80 hover:opacity-100 underline"
          >
            View on Basescan
          </a>
        </div>,
        { id: hash || undefined, duration: 8000 }
      );
    }
    if (confirmationError) {
      console.error("Error confirming fees transaction:", confirmationError);
      // Use confirmationError.message directly as it's more reliable
      toast.error(
        confirmationError.message || "Transaction confirmation failed",
        { id: hash || undefined }
      );
    }
  }, [isConfirmed, confirmationError, hash]);

  return (
    <div className="space-y-1">
      <button
        onClick={handleClaimFees}
        disabled={isClaimingFees || isConfirming || !isConnected}
        className={`${className} ${showSuccess ? "btn-success" : ""}`}
      >
        {isClaimingFees || isConfirming ? (
          <>
            <span className="loading loading-spinner"></span>
            {isConfirming ? "Confirming..." : "Claiming..."}
          </>
        ) : showSuccess ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Claimed!
          </>
        ) : !isConnected ? (
          "Connect Wallet"
        ) : (
          "Send Fees to Creator" // UI text, actual recipient is determined by contract
        )}
      </button>
      <div className="text-xs opacity-60 text-center">
        <div className="mt-1 text-xs text-amber-500">
          Note: Fees are sent to the creator&apos;s wallet (as per contract
          logic).
        </div>
      </div>
    </div>
  );
}
