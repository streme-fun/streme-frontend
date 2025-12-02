"use client";

import { useState } from "react";
import { useWalletClient } from "wagmi";
import { toast } from "sonner";
import { FEE_COLLECTOR, FEE_COLLECTOR_LETS } from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useWallet } from "@/src/hooks/useWallet";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { useSafeWallets } from "../hooks/useSafeWallet";
import { appendReferralTag, submitDivviReferral } from "@/src/lib/divvi";
import { ensureTxHash } from "@/src/lib/ensureTxHash";

interface ClaimFeesButtonProps {
  tokenAddress: string;
  creatorAddress?: string;
  className?: string;
}

export function ClaimFeesButton({
  tokenAddress,
  className = "btn btn-secondary w-full",
}: ClaimFeesButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [isClaimingFees, setIsClaimingFees] = useState(false);

  const {
    address: currentAddress,
    isConnected: walletIsConnected,
    isMiniApp,
  } = useWallet();
  const { getSafeEthereumProvider } = useAppFrameLogic();
  const { data: walletClient } = useWalletClient();
  const { wallets } = useSafeWallets();

  const handleClaimFees = async () => {
    if (!walletIsConnected || !currentAddress) {
      toast.error("Please connect your wallet.");
      return;
    }

    setIsClaimingFees(true);
    const toastId = toast.loading("Preparing transaction...");

    try {
      let txHash: `0x${string}` | undefined;

      if (isMiniApp) {
        const ethProvider = await getSafeEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available.");
        }

        const claimIface = new Interface([
          "function claimRewards(address token) external",
        ]);
        const claimData = claimIface.encodeFunctionData("claimRewards", [
          tokenAddress as `0x${string}`,
        ]);

        const claimDataWithReferral = await appendReferralTag(
          claimData as `0x${string}`,
          currentAddress as `0x${string}`
        );

        const rawTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: tokenAddress.toLowerCase() === '0x3ea91263dc6037ced4db9ff74a7de774df0f5355' ? FEE_COLLECTOR_LETS : FEE_COLLECTOR,
              from: currentAddress as `0x${string}`,
              data: claimDataWithReferral,
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });
        txHash = ensureTxHash(
          rawTxHash,
          "Farcaster Ethereum provider"
        );
      } else {
        // Desktop/Mobile Path - use wagmi/privy for transaction
        if (!currentAddress) {
          throw new Error("Wallet not connected.");
        }

        // Get provider from wagmi wallet client or connector fallback
        if (walletClient) {
          // Use wagmi wallet client for claiming fees
          const { encodeFunctionData } = await import("viem");
          const abi = [
            {
              inputs: [{ name: "token", type: "address" }],
              name: "claimRewards",
              outputs: [],
              stateMutability: "nonpayable",
              type: "function",
            },
          ] as const;

          const claimData = encodeFunctionData({
            abi,
            functionName: "claimRewards",
            args: [tokenAddress as `0x${string}`],
          });

          const claimDataWithReferral = await appendReferralTag(
            claimData,
            currentAddress as `0x${string}`
          );

          txHash = await walletClient.sendTransaction({
            to: tokenAddress.toLowerCase() === '0x3ea91263dc6037ced4db9ff74a7de774df0f5355' ? FEE_COLLECTOR_LETS : FEE_COLLECTOR,
            data: claimDataWithReferral,
            account: currentAddress as `0x${string}`,
            chain: undefined,
          });
        } else {
          // Fallback to connector-provided provider
          const wallet = wallets.find((w) => w.address === currentAddress);
          if (!wallet) {
            throw new Error("Wallet not found");
          }
          const provider = await wallet.getEthereumProvider();
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }],
          });

          const claimIface = new Interface([
            "function claimRewards(address token) external",
          ]);
          const claimData = claimIface.encodeFunctionData("claimRewards", [
            tokenAddress as `0x${string}`,
          ]);

          const claimDataWithReferral = await appendReferralTag(
            claimData as `0x${string}`,
            currentAddress as `0x${string}`
          );

          const rawTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: tokenAddress.toLowerCase() === '0x3ea91263dc6037ced4db9ff74a7de774df0f5355' ? FEE_COLLECTOR_LETS : FEE_COLLECTOR,
                from: currentAddress,
                data: claimDataWithReferral,
                chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
              },
            ],
          });
          txHash = ensureTxHash(
            rawTxHash,
            "Wallet connector provider"
          );
        }
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

      // Submit referral to Divvi
      await submitDivviReferral(txHash, 8453); // Base L2 chain ID

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

  // Show disabled button if wallet is not connected
  if (!walletIsConnected || !currentAddress) {
    return (
      <button disabled className={`${className} btn-disabled`}>
        Connect Wallet
      </button>
    );
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
