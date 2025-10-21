"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useWalletClient } from "wagmi";
import { useWallet } from "@/src/hooks/useWallet";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useSafeWallets } from "@/src/hooks/useSafeWallet";
import { useVaultAllocation } from "@/src/hooks/useVaultAllocation";
import { STREME_VAULT, STREME_VAULT_ABI } from "@/src/lib/contracts";
import { publicClient } from "@/src/lib/viemClient";
import { ensureTxHash } from "@/src/lib/ensureTxHash";

interface ClaimVaultButtonProps {
  tokenAddress: string;
  adminAddress: string;
  className?: string;
  onClaimed?: (txHash: `0x${string}`) => void;
}

const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export function ClaimVaultButton({
  tokenAddress,
  adminAddress,
  className = "btn btn-primary btn-sm",
  onClaimed,
}: ClaimVaultButtonProps) {
  const {
    address: currentAddress,
    isConnected,
    isMiniApp,
  } = useWallet();
  const { getSafeEthereumProvider } = useAppFrameLogic();
  const { data: walletClient } = useWalletClient();
  const { wallets } = useSafeWallets();
  const [isClaiming, setIsClaiming] = useState(false);

  const {
    data: allocation,
    isLoading: isAllocationLoading,
    error: allocationError,
    refetch,
  } = useVaultAllocation(tokenAddress, adminAddress);

  const claimStatus = useMemo(() => {
    if (!allocation) {
      return {
        reason: allocationError ? "Unable to load vault data" : "Vault not found",
        status: "unavailable" as const,
      };
    }

    if (allocation.amountTotal === BigInt(0)) {
      return {
        reason: "Vault has no allocated tokens",
        status: "empty" as const,
      };
    }

    if (
      allocation.amountClaimed >= allocation.amountTotal &&
      allocation.amountTotal > BigInt(0)
    ) {
      return {
        reason: "Vault distribution already claimed",
        status: "claimed" as const,
      };
    }

    const now = Math.floor(Date.now() / 1000);
    if (allocation.lockupEndTime > 0 && now < allocation.lockupEndTime) {
      return {
        reason: `Vault locked until ${formatTimestamp(
          allocation.lockupEndTime
        )}`,
        status: "locked" as const,
      };
    }

    return {
      reason: null,
      status: "claimable" as const,
    };
  }, [allocation, allocationError]);

  const handleClaimVault = async () => {
    if (!isConnected || !currentAddress) {
      toast.error("Please connect your wallet to claim.");
      return;
    }

    if (!allocation) {
      toast.error("Vault allocation data is unavailable.");
      return;
    }

    if (claimStatus.status !== "claimable") {
      toast.error(
        claimStatus.reason ??
          "Vault cannot be claimed at this time. Please try again later."
      );
      return;
    }

    setIsClaiming(true);
    const toastId = toast.loading("Preparing vault claim transaction...");

    try {
      let txHash: `0x${string}` | undefined;
      const { encodeFunctionData } = await import("viem");

      const claimData = encodeFunctionData({
        abi: STREME_VAULT_ABI,
        functionName: "claim",
        args: [
          tokenAddress as `0x${string}`,
          adminAddress as `0x${string}`,
        ],
      });

      if (isMiniApp) {
        const ethProvider = await getSafeEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available.");
        }

        const rawTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: STREME_VAULT,
              from: currentAddress as `0x${string}`,
              data: claimData,
              chainId: "0x2105", // Base mainnet chain ID (8453)
            },
          ],
        });
        txHash = ensureTxHash(rawTxHash, "Farcaster Ethereum provider");
      } else if (walletClient) {
        txHash = await walletClient.sendTransaction({
          to: STREME_VAULT,
          data: claimData,
          account: currentAddress as `0x${string}`,
          chain: undefined,
        });
      } else {
        const wallet = wallets.find((w) => w.address === currentAddress);
        if (!wallet) {
          throw new Error("Wallet not found for connected address.");
        }

        const provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        const rawTxHash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: STREME_VAULT,
              from: currentAddress,
              data: claimData,
              chainId: "0x2105",
            },
          ],
        });
        txHash = ensureTxHash(rawTxHash, "Wallet provider");
      }

      if (!txHash) {
        throw new Error("Transaction hash not received. Transaction cancelled?");
      }

      toast.loading("Confirming vault claim...", { id: toastId });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status !== "success") {
        throw new Error("Vault claim transaction failed.");
      }

      await refetch();

      if (onClaimed) {
        onClaimed(txHash);
      }

      toast.success(
        <div className="flex flex-col gap-2">
          <div>Vault distribution claimed successfully.</div>
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
    } catch (error) {
      console.error("Error claiming vault:", error);
      let message = "Failed to claim vault distribution.";
      if (error instanceof Error) {
        if (
          error.message.includes("User rejected") ||
          error.message.includes("user rejected")
        ) {
          message = "Transaction cancelled by user.";
        } else {
          message = error.message;
        }
      }
      toast.error(message, { id: toastId });
    } finally {
      setIsClaiming(false);
    }
  };

  const renderStatusNote = () => {
    if (isAllocationLoading) {
      return <span className="text-xs opacity-70">Checking vault status...</span>;
    }

    if (claimStatus.reason) {
      return (
        <span className="text-xs opacity-70">
          {claimStatus.reason}
        </span>
      );
    }

    if (claimStatus.status === "claimable") {
      return (
        <span className="text-xs opacity-70">
          Vault ready to claim.
        </span>
      );
    }

    return (
      <span className="text-xs opacity-70">
        Vault status unavailable.
      </span>
    );
  };

  const isDisabled =
    isAllocationLoading ||
    isClaiming ||
    claimStatus.status !== "claimable";

  return (
    <div className="flex flex-col gap-1">
      <button
        className={`${className} ${
          isDisabled ? "btn-disabled" : ""
        }`}
        onClick={handleClaimVault}
        disabled={isDisabled}
      >
        {isClaiming ? (
          <span className="loading loading-spinner loading-xs"></span>
        ) : (
          "Claim Vault"
        )}
      </button>
      {renderStatusNote()}
    </div>
  );
}
