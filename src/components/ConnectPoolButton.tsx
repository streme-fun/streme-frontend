"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { GDA_FORWARDER } from "@/src/lib/contracts";
import { sdk } from "@farcaster/frame-sdk";

const toHex = (address: string) => address as `0x${string}`;

interface ConnectPoolButtonProps {
  stakingPoolAddress: string;
  onSuccess?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
}

export function ConnectPoolButton({
  stakingPoolAddress,
  onSuccess,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
}: ConnectPoolButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!user?.wallet?.address;
  const effectiveAddress = isMiniApp ? farcasterAddress : user?.wallet?.address;

  const handleConnectPool = async () => {
    if (!effectiveIsConnected || !effectiveAddress) {
      toast.error("Wallet not connected or address unavailable.");
      return;
    }

    setIsConnecting(true);
    const toastId = toast.loading("Preparing pool connection...");

    try {
      let txHash: `0x${string}` | undefined;

      const iface = new Interface([
        "function connectPool(address pool, bytes userData) external returns (bool)",
      ]);
      const data = iface.encodeFunctionData("connectPool", [
        toHex(stakingPoolAddress),
        "0x" as const,
      ]);

      if (isMiniApp) {
        const ethProvider = sdk.wallet.ethProvider;
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available.");
        }

        txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(GDA_FORWARDER),
              from: effectiveAddress as `0x${string}`,
              data: toHex(data),
            },
          ],
        });
        if (!txHash) {
          throw new Error(
            "Pool connection transaction hash not received. User might have cancelled."
          );
        }
      } else {
        // Privy Path
        if (!user?.wallet?.address)
          throw new Error("Privy wallet not connected.");
        const wallet = wallets.find((w) => w.address === user.wallet?.address);
        if (!wallet) throw new Error("Privy Wallet not found");

        const provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }], // Base Mainnet
        });

        const privyTxHash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(GDA_FORWARDER),
              from: toHex(user.wallet.address), // Explicitly use privy address here
              data: toHex(data),
            },
          ],
        });
        txHash = privyTxHash as `0x${string}`;
        if (!txHash) {
          throw new Error(
            "Pool connection transaction hash not received (Privy). User might have cancelled."
          );
        }
      }

      toast.loading("Confirming transaction...", { id: toastId });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      toast.success(
        <div className="flex flex-col gap-2">
          <div>Successfully connected to reward pool!</div>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-80 hover:opacity-100 underline"
          >
            View on Basescan
          </a>
        </div>,
        { id: toastId }
      );

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: unknown) {
      console.error("Error connecting to pool:", error);
      let message = "Failed to connect to reward pool.";
      let errorDetails = "";
      if (typeof error === "object" && error !== null) {
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error(
        "ConnectPoolButton error details (stringified):",
        errorDetails
      );

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
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button
      onClick={handleConnectPool}
      disabled={isConnecting || !effectiveIsConnected}
      className="btn btn-primary w-full"
    >
      {isConnecting ? (
        <>
          <span className="loading loading-spinner loading-sm"></span>
          Connecting...
        </>
      ) : (
        "Connect to Reward Pool"
      )}
    </button>
  );
}
