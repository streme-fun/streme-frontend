"use client";

import { useState } from "react";
import { useSafeWallets } from "../hooks/useSafeWallet";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { toast } from "sonner";
import sdk from "@farcaster/miniapp-sdk";
import { usePostHog } from "posthog-js/react";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics";
import { formatUnits } from "viem";
import { useWallet } from "@/src/hooks/useWallet";

const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";
const STAKING_HELPER = "0xE7079CDB11C6ba1339A4BCB40753f4EC0215B364";

const gdaABI = [
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "member", type: "address" },
    ],
    name: "isMemberConnected",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const toHex = (address: string) => address as `0x${string}`;

interface StakeAllButtonProps {
  tokenAddress: string;
  stakingPoolAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  onSuccess?: () => void;
  onPoolConnect?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
  tokenBalance?: bigint;
  buttonText?: string;
}

export function StakeAllButton({
  tokenAddress,
  stakingPoolAddress,
  disabled,
  className,
  symbol,
  onSuccess,
  onPoolConnect,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
  tokenBalance = BigInt(0),
  buttonText = "Stake All",
}: StakeAllButtonProps) {
  const { wallets } = useSafeWallets();
  const { address: unifiedAddress, isConnected: unifiedIsConnected, isMiniApp: detectedMiniApp } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const postHog = usePostHog();

  const balance = tokenBalance;

  // Use unified wallet state, but fall back to props for compatibility
  const effectiveIsConnected = unifiedIsConnected || (isMiniApp ? farcasterIsConnected : false);
  const effectiveAddress = unifiedAddress || (isMiniApp ? farcasterAddress : undefined);

  const handleStakeAll = async () => {
    if (!effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected or address missing");
      return;
    }

    if (balance === 0n) {
      toast.error("No tokens available to stake");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Preparing stake all transaction...");

    try {
      let connectTxHash: `0x${string}` | undefined;

      // Get provider
      let provider: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      let userAddress: string;

      if (detectedMiniApp || isMiniApp) {
        provider = await sdk.wallet.getEthereumProvider();
        if (!provider) {
          throw new Error("Farcaster Ethereum provider not available");
        }
        userAddress = effectiveAddress!;
      } else {
        if (!effectiveAddress) {
          throw new Error("Wallet not connected");
        }
        userAddress = effectiveAddress;
        const wallet = wallets.find((w) => w.address?.toLowerCase() === effectiveAddress.toLowerCase());
        if (!wallet) {
          throw new Error("Wallet not found");
        }
        provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      }

      // Send all tokens directly to StakingHelper
      toast.loading("Staking tokens...", { id: toastId });

      const sendIface = new Interface([
        "function send(address recipient, uint256 amount, bytes userData) external",
      ]);
      const sendData = sendIface.encodeFunctionData("send", [
        toHex(STAKING_HELPER),
        balance,
        "0x", // empty userData
      ]);

      const stakeTxHash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: toHex(tokenAddress),
            from: toHex(userAddress),
            data: toHex(sendData),
            chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
          },
        ],
      });

      if (!stakeTxHash) {
        throw new Error("Staking operation was cancelled");
      }

      toast.loading("Waiting for staking confirmation...", { id: toastId });
      const stakeReceipt = await publicClient.waitForTransactionReceipt({
        hash: stakeTxHash as `0x${string}`,
      });

      if (stakeReceipt.status !== "success") {
        throw new Error("Staking operation failed");
      }

      toast.success("Staking successful!", { id: toastId });

      // Handle pool connection if needed (this part remains the same)
      if (
        stakingPoolAddress &&
        stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        const connected = await publicClient.readContract({
          address: toHex(GDA_FORWARDER),
          abi: gdaABI,
          functionName: "isMemberConnected",
          args: [toHex(stakingPoolAddress), toHex(userAddress)],
        });
        if (!connected) {
          toast.loading("Connecting to reward pool...", { id: toastId });
          const gdaIface = new Interface([
            "function connectPool(address pool, bytes calldata userData) external returns (bool)",
          ]);
          const connectData = gdaIface.encodeFunctionData("connectPool", [
            toHex(stakingPoolAddress),
            "0x",
          ]);

          const connectTxParams: Record<string, unknown> = {
            to: toHex(GDA_FORWARDER),
            from: toHex(userAddress),
            data: toHex(connectData),
            chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
          };

          connectTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [connectTxParams],
          });

          if (!connectTxHash) {
            throw new Error("Pool connection transaction was cancelled");
          }

          await publicClient.waitForTransactionReceipt({
            hash: connectTxHash,
          });
          toast.success("Connected to reward pool!", { id: toastId });
          onPoolConnect?.();
        }
      }

      // Success - refresh balance and trigger callbacks
      onSuccess?.();
      toast.success(`Successfully staked all ${symbol} tokens!`, {
        id: toastId,
      });

      // PostHog event tracking
      postHog.capture(POSTHOG_EVENTS.STAKE_ALL_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOKEN_ADDRESS]: tokenAddress,
        [ANALYTICS_PROPERTIES.STAKING_ADDRESS]: STAKING_HELPER,
        [ANALYTICS_PROPERTIES.STAKING_POOL_ADDRESS]: stakingPoolAddress,
        [ANALYTICS_PROPERTIES.TOKEN_SYMBOL]: symbol,
        [ANALYTICS_PROPERTIES.AMOUNT_WEI]: balance.toString(),
        [ANALYTICS_PROPERTIES.AMOUNT_FORMATTED]: formatUnits(balance, 18),
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: effectiveAddress,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: detectedMiniApp || isMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: stakeTxHash,
        [ANALYTICS_PROPERTIES.HAS_POOL_CONNECTION]:
          !!stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000",
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: detectedMiniApp || isMiniApp ? "farcaster" : "wagmi",
      });
    } catch (error: unknown) {
      console.error("StakeAllButton caught error:", error);
      let message = "Stake all operation failed.";

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
        }
      }

      toast.error(message, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show button if no balance
  if (balance === 0n) {
    return null;
  }

  return (
    <button
      onClick={handleStakeAll}
      disabled={disabled || isLoading || balance === 0n}
      className={className}
    >
      {isLoading ? "Processing..." : buttonText}
    </button>
  );
}
