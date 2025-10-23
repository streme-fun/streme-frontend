"use client";

import { useState, useEffect } from "react";
import { useWalletClient } from "wagmi";
import { StakeModal } from "./StakeModal";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { useWallet } from "@/src/hooks/useWallet";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics";
import { formatUnits } from "viem";
import { appendReferralTag, submitDivviReferral } from "@/src/lib/divvi";

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

interface StakeButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  totalStakers?: string;
  onSuccess?: () => void;
  onPoolConnect?: () => void;
  tokenBalance?: bigint;
  lockDuration?: number; // Lock duration in seconds (defaults to 24h for v1 tokens)
}

export function StakeButton({
  tokenAddress,
  stakingAddress,
  stakingPoolAddress,
  disabled,
  className,
  symbol,
  totalStakers,
  onSuccess,
  onPoolConnect,
  tokenBalance = BigInt(0),
  lockDuration,
}: StakeButtonProps) {
  const { address, isConnected, isMiniApp } = useWallet();
  const { data: walletClient } = useWalletClient();
  const { getSafeEthereumProvider } = useAppFrameLogic();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actualBalance, setActualBalance] = useState<bigint>(tokenBalance);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const postHog = usePostHog();

  // Fetch actual current balance from blockchain - only when address or token changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !tokenAddress) return;
      
      setIsLoadingBalance(true);
      try {
        const balance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
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
          args: [address as `0x${string}`],
        });
        setActualBalance(balance as bigint);
      } catch (error) {
        console.warn("Failed to fetch token balance:", error);
        // Fall back to passed balance if fetch fails
        setActualBalance(tokenBalance);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [address, tokenAddress]); // Removed tokenBalance dependency to prevent refresh loops

  // Update actual balance when tokenBalance prop changes (but don't fetch)
  useEffect(() => {
    if (tokenBalance > 0n && !isLoadingBalance) {
      setActualBalance(tokenBalance);
    }
  }, [tokenBalance, isLoadingBalance]);

  // Use actual blockchain balance
  const balance = actualBalance;

  const handleStake = async (amount: bigint) => {
    if (!address || !isConnected) {
      toast.error("Wallet not connected or address missing");
      throw new Error("Wallet not connected or address missing");
    }

    // Pre-flight checks before attempting the transaction
    if (amount <= 0n) {
      toast.error("Invalid stake amount");
      throw new Error("Invalid stake amount");
    }

    if (balance < amount) {
      toast.error("Insufficient token balance for staking");
      throw new Error("Insufficient token balance for staking");
    }

    setIsLoading(true);
    const toastId = toast.loading("Preparing stake transaction...");

    try {
      let stakeTxHash: `0x${string}` | undefined;
      let connectTxHash: `0x${string}` | undefined;

      if (isMiniApp) {
        const ethProvider = await getSafeEthereumProvider();
        if (!ethProvider)
          throw new Error("Farcaster Ethereum provider not available.");

        toast.loading("Staking tokens...", { id: toastId });
        const sendIface = new Interface([
          "function send(address recipient, uint256 amount, bytes userData) external",
        ]);
        const sendData = sendIface.encodeFunctionData("send", [
          toHex(STAKING_HELPER),
          amount,
          "0x", // empty userData
        ]);
        const sendDataWithReferral = await appendReferralTag(
          toHex(sendData),
          toHex(address!)
        );
        stakeTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(tokenAddress),
              from: toHex(address!),
              data: sendDataWithReferral,
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });
        if (!stakeTxHash)
          throw new Error(
            "Stake transaction hash not received. User might have cancelled."
          );
        toast.loading("Waiting for stake confirmation...", { id: toastId });
        const stakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: stakeTxHash,
        });
        if (stakeReceipt.status !== "success")
          throw new Error("Stake transaction failed");

        // Submit referral to Divvi
        await submitDivviReferral(stakeTxHash, 8453); // Base L2 chain ID

        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(address!)],
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
            const connectDataWithReferral = await appendReferralTag(
              toHex(connectData),
              toHex(address!)
            );
            connectTxHash = await ethProvider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  to: toHex(GDA_FORWARDER),
                  from: toHex(address!),
                  data: connectDataWithReferral,
                  chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
                },
              ],
            });
            if (!connectTxHash)
              throw new Error("Pool connection transaction hash not received.");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });

            // Submit referral to Divvi
            await submitDivviReferral(connectTxHash, 8453); // Base L2 chain ID

            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      } else {
        // Desktop/Mobile Path - use wagmi for transaction
        if (!address) {
          throw new Error("Wallet not connected.");
        }

        if (!walletClient) {
          throw new Error("Wallet client not available");
        }

        toast.loading("Staking tokens...", { id: toastId });

        // Use wagmi wallet client for sending
        const { encodeFunctionData } = await import("viem");
        const abi = [
          {
            inputs: [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" },
              { name: "userData", type: "bytes" },
            ],
            name: "send",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ] as const;

        const sendData = encodeFunctionData({
          abi,
          functionName: "send",
          args: [toHex(STAKING_HELPER), amount, "0x"],
        });

        const sendDataWithReferral = await appendReferralTag(
          sendData,
          toHex(address!)
        );

        stakeTxHash = await walletClient!.sendTransaction({
          to: toHex(tokenAddress),
          data: sendDataWithReferral,
          account: toHex(address!),
          chain: undefined,
        });

        if (!stakeTxHash)
          throw new Error(
            "Stake transaction hash not received. User might have cancelled."
          );
        toast.loading("Waiting for stake confirmation...", { id: toastId });
        const stakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: stakeTxHash,
        });
        if (stakeReceipt.status !== "success")
          throw new Error("Stake transaction failed");

        // Submit referral to Divvi
        await submitDivviReferral(stakeTxHash, 8453); // Base L2 chain ID

        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(address!)],
          });
          if (!connected) {
            toast.loading("Connecting to reward pool...", { id: toastId });

            // Use wagmi wallet client for pool connection
            const { encodeFunctionData } = await import("viem");
            const abi = [
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
            ] as const;

            const connectData = encodeFunctionData({
              abi,
              functionName: "connectPool",
              args: [toHex(stakingPoolAddress), "0x"],
            });

            const connectDataWithReferral = await appendReferralTag(
              connectData,
              toHex(address!)
            );

            connectTxHash = await walletClient!.sendTransaction({
              to: toHex(GDA_FORWARDER),
              data: connectDataWithReferral,
              account: toHex(address!),
              chain: undefined,
            });

            if (!connectTxHash)
              throw new Error("Pool connection transaction hash not received.");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });

            // Submit referral to Divvi
            await submitDivviReferral(connectTxHash, 8453); // Base L2 chain ID

            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      }
      
      // Refresh balance after successful stake
      try {
        const newBalance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
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
          args: [address as `0x${string}`],
        });
        setActualBalance(newBalance as bigint);
      } catch (error) {
        console.warn("Failed to refresh balance after staking:", error);
      }
      
      // Common success path if all transactions succeeded
      onSuccess?.();

      // PostHog event tracking
      postHog.capture(POSTHOG_EVENTS.STAKE_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOKEN_ADDRESS]: tokenAddress,
        [ANALYTICS_PROPERTIES.STAKING_ADDRESS]: stakingAddress,
        [ANALYTICS_PROPERTIES.STAKING_POOL_ADDRESS]: stakingPoolAddress,
        [ANALYTICS_PROPERTIES.TOKEN_SYMBOL]: symbol,
        [ANALYTICS_PROPERTIES.AMOUNT_WEI]: amount.toString(),
        [ANALYTICS_PROPERTIES.AMOUNT_FORMATTED]: formatUnits(amount, 18),
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: address,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: stakeTxHash,
        [ANALYTICS_PROPERTIES.HAS_POOL_CONNECTION]:
          !!stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000",
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isMiniApp
          ? "farcaster"
          : "privy",
      });
    } catch (error: unknown) {
      console.error("StakeButton caught error:", error);
      let message = "Stake operation failed.";
      let errorDetails = "";
      if (typeof error === "object" && error !== null) {
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error("StakeButton error details (stringified):", errorDetails);

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
          } else if (
            errorMessage.includes("Insufficient token balance") ||
            errorMessage.includes("Invalid stake amount") ||
            errorMessage.includes("Gas estimation failed") ||
            errorMessage.includes("Staking contract rejected")
          ) {
            // Use our custom error messages as-is
            message = errorMessage;
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
        } else if (errorDetails.includes("execution reverted")) {
          message =
            "Transaction failed. This could be due to insufficient balance, contract restrictions, or minimum staking requirements.";
        }
      }
      toast.error(message, { id: toastId });
      // Rethrow the error so that StakeModal's internal catch block can also handle it if needed for its UI
      // Or, ensure StakeModal's onStake is not trying to set its own success state if this promise rejects.
      // The current StakeModal updates its UI based on onStake promise resolution.
      // So, throwing here is correct to signal failure to StakeModal.
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleModalOpen}
        disabled={disabled || isLoading || isLoadingBalance} // Disable button when loading
        className={className}
      >
        {isLoading ? "Processing..." : isLoadingBalance ? "Loading..." : "Stake"}
      </button>

      <StakeModal
        isOpen={isModalOpen}
        onClose={() => !isLoading && setIsModalOpen(false)} // Prevent closing modal while loading
        tokenAddress={tokenAddress}
        stakingAddress={stakingAddress}
        balance={balance}
        symbol={symbol}
        totalStakers={totalStakers}
        onStake={handleStake}
        onSuccess={onSuccess} // Pass onSuccess to modal if it needs to trigger something on close after success
        isMiniApp={isMiniApp}
        lockDuration={lockDuration}
      />
    </>
  );
}
