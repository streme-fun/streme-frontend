"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { LP_FACTORY_ADDRESS } from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import sdk from "@farcaster/frame-sdk";

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
  const [isClaimingFees, setIsClaimingFees] = useState(false);

  const {
    isSDKLoaded: fcSDKLoaded,
    isMiniAppView: detectedMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
    farcasterContext,
  } = useAppFrameLogic();

  const { address: wagmiAddress } = useAccount();

  // More robust mini app detection
  const isEffectivelyMiniApp =
    isMiniAppProp ?? (detectedMiniAppView && fcSDKLoaded && !!farcasterContext);

  // Simplified wallet connection logic - match MyTokensModal pattern
  const currentAddress = isEffectivelyMiniApp 
    ? (farcasterAddress ?? fcAddress)
    : wagmiAddress;
  
  const walletIsConnected = isEffectivelyMiniApp 
    ? (farcasterIsConnected ?? fcIsConnected)
    : !!wagmiAddress;

  const handleClaimFees = async () => {
    if (!walletIsConnected || !currentAddress) {
      toast.error("Please connect your wallet.");
      return;
    }

    setIsClaimingFees(true);
    const toastId = toast.loading("Preparing transaction...");

    try {
      let txHash: `0x${string}` | undefined;

      if (isEffectivelyMiniApp) {
        const ethProvider = await sdk.wallet.getEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available.");
        }

        const claimIface = new Interface([
          "function claimRewards(address token) external",
        ]);
        const claimData = claimIface.encodeFunctionData("claimRewards", [
          tokenAddress as `0x${string}`,
        ]);

        txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: LP_FACTORY_ADDRESS,
              from: currentAddress,
              data: claimData as `0x${string}`,
            },
          ],
        });
      } else {
        // Desktop/Mobile Path - use wagmi for transaction
        if (!currentAddress) {
          throw new Error("Wallet not connected.");
        }

        // For desktop/mobile, we would use wagmi's writeContract or similar
        // For now, throwing error as this requires additional wagmi setup
        throw new Error("Desktop transaction support not implemented yet. Please use the mini-app.");
      }

      if (!txHash) {
        throw new Error(
          "Transaction hash not received. User might have cancelled."
        );
      }

      toast.loading("Confirming transaction...", { id: toastId });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status !== "success") {
        throw new Error("Transaction failed or reverted.");
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      toast.success(
        <div className="flex flex-col gap-2">
          <div>Successfully claimed LP fees!</div>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-80 hover:opacity-100 underline"
          >
            View on Basescan
          </a>
        </div>,
        { id: toastId, duration: 8000 }
      );
    } catch (error: unknown) {
      console.error("Error claiming fees:", error);
      let message = "Failed to claim fees";
      if (error instanceof Error) {
        if (
          error.message.includes("User rejected") ||
          error.message.includes("cancelled")
        ) {
          message = "Transaction rejected";
        } else {
          message = error.message;
        }
      }
      toast.error(message, { id: toastId });
    } finally {
      setIsClaimingFees(false);
    }
  };

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
    fcAddress,
    fcIsConnected,
  ]);

  // Don't render anything if wallet is not connected - let TokenActions handle the connect wallet UI
  if (!walletIsConnected || !currentAddress) {
    return null;
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClaimFees}
        disabled={isClaimingFees || !walletIsConnected}
        className={`${className} ${showSuccess ? "btn-success" : ""}`}
      >
        {isClaimingFees ? (
          <>
            <span className="loading loading-spinner"></span>
            Claiming...
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
        ) : (
          "Claim Fees" // UI text, actual recipient is determined by contract
        )}
      </button>
      {/* <div className="text-xs opacity-60 text-center">
        <div className="mt-1 text-xs text-amber-500">
          Note: Fees are sent to the creator&apos;s wallet.
        </div>
      </div> */}
    </div>
  );
}
