"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { GDA_FORWARDER } from "@/app/lib/contracts";

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL || "https://base.llamarpc.com"
  ),
});

interface ConnectPoolButtonProps {
  poolAddress: string;
  onSuccess?: () => void;
}

export function ConnectPoolButton({
  poolAddress,
  onSuccess,
}: ConnectPoolButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const handleConnectPool = async () => {
    if (!user?.wallet?.address) return;

    setIsConnecting(true);
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
          "function connectPool(address pool, bytes userData) external returns (bool)",
        ]);
        const data = iface.encodeFunctionData("connectPool", [
          poolAddress as `0x${string}`,
          "0x" as const,
        ]);

        // Send the transaction
        const tx = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: GDA_FORWARDER,
              from: user.wallet.address,
              data,
            },
          ],
        });

        toast.loading("Confirming transaction...", { id: toastId });

        await publicClient.waitForTransactionReceipt({
          hash: tx as `0x${string}`,
        });

        toast.success(
          <div className="flex flex-col gap-2">
            <div>Successfully connected to reward pool!</div>
            <a
              href={`https://basescan.org/tx/${tx}`}
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
        // Handle user rejection
        if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string" &&
          error.message.includes("rejected")
        ) {
          toast.error("Transaction rejected", { id: toastId });
        } else {
          console.error("Error connecting to pool:", error);
          toast.error("Failed to connect to reward pool", { id: toastId });
        }
      }
    } catch (error) {
      console.error("Error setting up connection:", error);
      toast.error("Failed to setup connection", { id: toastId });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button
      onClick={handleConnectPool}
      disabled={isConnecting}
      className="btn btn-sm btn-primary"
    >
      {isConnecting ? (
        <>
          <span className="loading loading-spinner loading-sm"></span>
          Connecting...
        </>
      ) : (
        "Connect"
      )}
    </button>
  );
}
