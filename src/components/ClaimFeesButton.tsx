"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { LP_FACTORY_ADDRESS, LP_FACTORY_ABI } from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

interface ClaimFeesButtonProps {
  tokenAddress: string;
  creatorAddress?: string;
  className?: string;
  isMiniApp?: boolean;
  farcasterAddress?: `0x${string}` | undefined;
  farcasterIsConnected?: boolean;
}

export function ClaimFeesButton({
  tokenAddress,
  className = "btn btn-secondary w-full",
  isMiniApp: isMiniAppProp,
  farcasterAddress,
  farcasterIsConnected,
}: ClaimFeesButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    isSDKLoaded: fcSDKLoaded,
    isMiniAppView: detectedMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
    farcasterContext,
  } = useAppFrameLogic();

  const { user: privyUser, ready: privyReady } = usePrivy();

  // More robust mini app detection
  const isEffectivelyMiniApp =
    isMiniAppProp ?? (detectedMiniAppView && fcSDKLoaded && !!farcasterContext);

  // Determine which authentication system to use
  let currentAddress: `0x${string}` | undefined;
  let walletIsConnected: boolean;

  if (isEffectivelyMiniApp) {
    currentAddress = farcasterAddress ?? fcAddress;
    walletIsConnected = farcasterIsConnected ?? fcIsConnected;
  } else {
    currentAddress = privyUser?.wallet?.address as `0x${string}` | undefined;
    walletIsConnected = privyReady && !!privyUser?.wallet?.address;
  }

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
    if (!walletIsConnected || !currentAddress) {
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

  // Debug logging
  useEffect(() => {
    console.log("ClaimFeesButton authentication state:", {
      isEffectivelyMiniApp,
      isMiniAppProp,
      detectedMiniAppView,
      fcSDKLoaded,
      farcasterContext: !!farcasterContext,
      currentAddress,
      walletIsConnected,
      privyReady,
      privyUserAddress: privyUser?.wallet?.address,
      fcAddress,
      fcIsConnected,
    });
  }, [
    isEffectivelyMiniApp,
    isMiniAppProp,
    detectedMiniAppView,
    fcSDKLoaded,
    farcasterContext,
    currentAddress,
    walletIsConnected,
    privyReady,
    privyUser?.wallet?.address,
    fcAddress,
    fcIsConnected,
  ]);

  return (
    <div className="space-y-1">
      <button
        onClick={handleClaimFees}
        disabled={isClaimingFees || isConfirming || !walletIsConnected}
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
        ) : !walletIsConnected ? (
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
