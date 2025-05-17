"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { LP_FACTORY_ADDRESS } from "@/app/lib/contracts";
import { publicClient } from "@/app/lib/viemClient";

interface ClaimFeesButtonProps {
  tokenAddress: string;
  creatorAddress?: string;
  className?: string;
}

export function ClaimFeesButton({
  tokenAddress,
  className = "btn btn-secondary w-full",
}: ClaimFeesButtonProps) {
  const [isClaimingFees, setIsClaimingFees] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const handleClaimFees = async () => {
    if (!user?.wallet?.address) return;

    setIsClaimingFees(true);
    const toastId = toast.loading("Preparing transaction...");

    try {
      const wallet = wallets.find((w) => w.address === user.wallet?.address);

      if (!wallet) {
        toast.error("Wallet not found", { id: toastId });
        return;
      }

      const provider = await wallet.getEthereumProvider();

      try {
        // Encode the function call
        const iface = new Interface([
          "function claimRewards(address token) external",
        ]);
        const data = iface.encodeFunctionData("claimRewards", [
          tokenAddress as `0x${string}`,
        ]);

        // Send the transaction
        const tx = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: LP_FACTORY_ADDRESS,
              from: user.wallet.address,
              data,
            },
          ],
        });

        toast.loading("Confirming transaction...", { id: toastId });

        // Wait for transaction confirmation
        await publicClient.waitForTransactionReceipt({
          hash: tx as `0x${string}`,
        });

        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000); // Reset after 3 seconds

        toast.success(
          <div className="flex flex-col gap-2">
            <div>Successfully claimed LP fees!</div>
            <a
              href={`https://basescan.org/tx/${tx}`}
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
        if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string" &&
          error.message.includes("rejected")
        ) {
          toast.error("Transaction rejected", { id: toastId });
        } else {
          console.error("Error claiming fees:", error);
          toast.error("Failed to claim fees", { id: toastId });
        }
      }
    } catch (error) {
      console.error("Error setting up connection:", error);
      toast.error("Failed to setup connection", { id: toastId });
    } finally {
      setIsClaimingFees(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={handleClaimFees}
        disabled={isClaimingFees || !user?.wallet?.address}
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
        ) : !user?.wallet?.address ? (
          "Connect Wallet"
        ) : (
          "Send Fees to Creator"
        )}
      </button>
      <div className="text-xs opacity-60 text-center">
        <div className="mt-1 text-xs text-amber-500">
          Note: Fees are sent to the creator&apos;s wallet.
        </div>
      </div>
    </div>
  );
}
