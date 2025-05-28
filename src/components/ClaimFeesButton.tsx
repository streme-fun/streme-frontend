"use client";

import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { toast } from "sonner";
import { LP_FACTORY_ADDRESS } from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { sdk } from "@farcaster/frame-sdk";

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

  const { user: privyUser, ready: privyReady } = usePrivy();
  const { wallets } = useWallets();

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
    // For non-mini apps, use more robust Privy wallet detection
    currentAddress = privyUser?.wallet?.address as `0x${string}` | undefined;
    const hasPrivyWallet = privyReady && !!privyUser?.wallet?.address;
    const walletsReady = wallets && wallets.length > 0;
    const exactWalletMatch =
      walletsReady &&
      wallets.some((w) => w.address === privyUser?.wallet?.address);
    const caseInsensitiveMatch =
      walletsReady &&
      wallets.some(
        (w) =>
          w.address?.toLowerCase() === privyUser?.wallet?.address?.toLowerCase()
      );
    const singleWalletFallback =
      walletsReady && wallets.length === 1 && hasPrivyWallet;

    walletIsConnected =
      hasPrivyWallet &&
      walletsReady &&
      (exactWalletMatch || caseInsensitiveMatch || singleWalletFallback);
  }

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
        const ethProvider = sdk.wallet.ethProvider;
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
        // Privy Path
        if (!privyUser?.wallet?.address) {
          throw new Error("Privy wallet not connected.");
        }

        // Find wallet with fallback logic
        let wallet = wallets?.find(
          (w) => w.address === privyUser.wallet?.address
        );
        if (!wallet && wallets && wallets.length > 0) {
          // Try case-insensitive match
          wallet = wallets.find(
            (w) =>
              w.address?.toLowerCase() ===
              privyUser.wallet?.address?.toLowerCase()
          );
        }
        if (!wallet && wallets && wallets.length === 1) {
          // Single wallet fallback
          wallet = wallets[0];
        }
        if (!wallet) throw new Error("Privy Wallet not found");

        // Use the wallet's actual address, not user.wallet.address
        const walletAddress = wallet.address;
        if (!walletAddress) throw new Error("Wallet address not available");

        const provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }], // Base Mainnet
        });

        const claimIface = new Interface([
          "function claimRewards(address token) external",
        ]);
        const claimData = claimIface.encodeFunctionData("claimRewards", [
          tokenAddress as `0x${string}`,
        ]);

        txHash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: LP_FACTORY_ADDRESS,
              from: walletAddress as `0x${string}`,
              data: claimData as `0x${string}`,
            },
          ],
        });
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
        ) : !walletIsConnected ? (
          "Connect Wallet"
        ) : (
          "Claim Fees" // UI text, actual recipient is determined by contract
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
