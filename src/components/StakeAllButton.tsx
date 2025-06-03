"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { toast } from "sonner";
import { sdk } from "@farcaster/frame-sdk";
import { usePostHog } from "posthog-js/react";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics";
import { formatUnits } from "viem";

const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";
// Contract addresses for macro system
const STAKING_MACRO_V2 = "0x5c4b8561363E80EE458D3F0f4F14eC671e1F54Af";
const MACRO_FORWARDER = "0xFD0268E33111565dE546af2675351A4b1587F89F";

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

// ABIs for the macro contracts
const stakingMacroABI = [
  {
    inputs: [{ name: "tokens", type: "address[]" }],
    name: "getParams",
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const toHex = (address: string) => address as `0x${string}`;

interface StakeAllButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  onSuccess?: () => void;
  onPoolConnect?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
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
}: StakeAllButtonProps) {
  const { wallets } = useWallets();
  const { address: wagmiAddress } = useAccount();
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);
  const postHog = usePostHog();

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!wagmiAddress;
  const effectiveAddress = isMiniApp ? farcasterAddress : wagmiAddress;

  const fetchBalance = useCallback(async () => {
    if (!effectiveAddress || !effectiveIsConnected) {
      setBalance(0n);
      return;
    }

    try {
      const bal = await publicClient.readContract({
        address: toHex(tokenAddress),
        abi: [
          {
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [toHex(effectiveAddress)],
      });
      setBalance(bal);
    } catch (error) {
      console.error("Error fetching token balance:", error);
      setBalance(0n);
    }
  }, [effectiveAddress, effectiveIsConnected, tokenAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

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

      if (isMiniApp) {
        provider = sdk.wallet.ethProvider;
        if (!provider) {
          throw new Error("Farcaster Ethereum provider not available");
        }
        userAddress = effectiveAddress!;
      } else {
        if (!wagmiAddress) {
          throw new Error("Wagmi wallet not connected");
        }
        userAddress = wagmiAddress;
        const wallet = wallets.find((w) => w.address === wagmiAddress);
        if (!wallet) {
          throw new Error("Wallet not found");
        }
        provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      }

      // Use macro system to stake all tokens without approval
      toast.loading("Executing staking operation...", { id: toastId });

      // Get encoded parameters from StakingMacroV2 for this single token
      const encodedAddresses = await publicClient.readContract({
        address: toHex(STAKING_MACRO_V2),
        abi: stakingMacroABI,
        functionName: "getParams",
        args: [[toHex(tokenAddress)]],
      });

      // Execute the macro via MacroForwarder
      // This handles everything in batch "in first person" by the user
      const macroIface = new Interface([
        "function runMacro(address macro, bytes calldata params) external",
      ]);
      const macroData = macroIface.encodeFunctionData("runMacro", [
        toHex(STAKING_MACRO_V2),
        encodedAddresses,
      ]);

      const macroTxParams: Record<string, unknown> = {
        to: toHex(MACRO_FORWARDER),
        from: toHex(userAddress),
        data: toHex(macroData),
      };

      // Add gas estimation for non-miniApp
      if (!isMiniApp) {
        try {
          const estimatedGas = await publicClient.estimateGas({
            account: userAddress as `0x${string}`,
            to: toHex(MACRO_FORWARDER),
            data: macroData as `0x${string}`,
          });
          const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.5));
          macroTxParams.gas = `0x${gasLimit.toString(16)}`;
        } catch {
          console.warn("Gas estimation failed, proceeding without gas limit");
        }
      }

      const stakeTxHash = await provider.request({
        method: "eth_sendTransaction",
        params: [macroTxParams],
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
      await fetchBalance();
      onSuccess?.();
      toast.success(`Successfully staked all ${symbol} tokens!`, {
        id: toastId,
      });

      // PostHog event tracking
      postHog.capture(POSTHOG_EVENTS.STAKE_ALL_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOKEN_ADDRESS]: tokenAddress,
        [ANALYTICS_PROPERTIES.STAKING_POOL_ADDRESS]: stakingPoolAddress,
        [ANALYTICS_PROPERTIES.TOKEN_SYMBOL]: symbol,
        [ANALYTICS_PROPERTIES.AMOUNT_WEI]: balance.toString(),
        [ANALYTICS_PROPERTIES.AMOUNT_FORMATTED]: formatUnits(balance, 18),
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: effectiveAddress,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: stakeTxHash,
        [ANALYTICS_PROPERTIES.HAS_POOL_CONNECTION]:
          !!stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000",
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isMiniApp ? "farcaster" : "wagmi",
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
      {isLoading ? "Processing..." : "Stake All"}
    </button>
  );
}
