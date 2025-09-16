"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { GDA_FORWARDER } from "@/src/lib/contracts";
import { ensureTxHash } from "@/src/lib/ensureTxHash";
import sdk from "@farcaster/miniapp-sdk";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useSafeWallets } from "../hooks/useSafeWallet";

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

  const { address: wagmiAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { wallets } = useSafeWallets();
  const { address: fcAddress, isConnected: fcIsConnected } = useAppFrameLogic();

  // Use explicit mini-app check with fallback to passed prop
  const isEffectivelyMiniApp = isMiniApp || false;

  const currentAddress = isEffectivelyMiniApp
    ? farcasterAddress ?? fcAddress
    : wagmiAddress;

  const walletIsConnected = isEffectivelyMiniApp
    ? farcasterIsConnected ?? fcIsConnected
    : !!wagmiAddress;

  const handleConnectPool = async () => {
    if (!walletIsConnected || !currentAddress) {
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

      if (isEffectivelyMiniApp) {
        const ethProvider = await sdk.wallet.getEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available.");
        }

        const rawTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(GDA_FORWARDER),
              from: currentAddress as `0x${string}`,
              data: toHex(data),
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });
        txHash = ensureTxHash(
          rawTxHash,
          "Farcaster Ethereum provider"
        );

        if (!txHash) {
          throw new Error(
            "Pool connection transaction hash not received. User might have cancelled."
          );
        }
      } else {
        // Desktop/Mobile Path - use wagmi/RainbowKit for transaction
        if (!currentAddress) {
          throw new Error("Wallet not connected.");
        }

        // Get provider from wagmi wallet client or connector fallback
        if (walletClient) {
          // Use wagmi wallet client for pool connection
          txHash = await walletClient.writeContract({
            address: toHex(GDA_FORWARDER),
            abi: [
              {
                inputs: [
                  { name: "pool", type: "address" },
                  { name: "userData", type: "bytes" },
                ],
                name: "connectPool",
                outputs: [{ name: "", type: "bool" }],
                stateMutability: "nonpayable",
                type: "function",
              },
            ],
            functionName: "connectPool",
            args: [toHex(stakingPoolAddress), "0x"],
          });
        } else {
          // Fallback to connector-provided provider
          const wallet = wallets.find((w) => w.address === wagmiAddress);
          if (!wallet) {
            throw new Error("Wallet not found");
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
                to: toHex(GDA_FORWARDER),
                from: currentAddress as `0x${string}`,
                data: toHex(data),
                chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
              },
            ],
          });
          txHash = ensureTxHash(
            rawTxHash,
            "Wallet connector provider"
          );
        }

        if (!txHash) {
          throw new Error(
            "Pool connection transaction hash not received. User might have cancelled."
          );
        }
      }

      toast.loading("Confirming transaction...", { id: toastId });

      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60000, // 60 second timeout
      });

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
      disabled={isConnecting || !walletIsConnected}
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
