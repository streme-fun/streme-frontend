"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { UnstakeModal } from "./UnstakeModal";
import { publicClient } from "@/src/lib/viemClient";
import { Interface } from "@ethersproject/abi";
import sdk from "@farcaster/miniapp-sdk";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics";
import { formatUnits } from "viem";
import { useWallets } from "@privy-io/react-auth";
import { appendReferralTag, submitDivviReferral } from "@/src/lib/divvi";

const stakingAbiEthers = [
  "function unstake(address to, uint256 amount)",
  "function depositTimestamps(address account) view returns (uint256)",
];

const stakingAbiViem = [
  {
    name: "unstake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "depositTimestamps",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const toHex = (address: string) => address as `0x${string}`;

interface UnstakeButtonProps {
  stakingAddress: string;
  userStakedBalance: bigint;
  disabled?: boolean;
  className?: string;
  symbol: string;
  onSuccess?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
}

export function UnstakeButton({
  stakingAddress,
  userStakedBalance,
  disabled,
  className,
  symbol,
  onSuccess,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
}: UnstakeButtonProps) {
  const { address: wagmiAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { wallets } = useWallets();
  const {
    address: fcAddress,
    isConnected: fcIsConnected,
  } = useAppFrameLogic();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unlockTime, setUnlockTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const postHog = usePostHog();

  // Use explicit mini-app check with fallback to passed prop
  const isEffectivelyMiniApp = isMiniApp || false;
  
  const currentAddress = isEffectivelyMiniApp 
    ? (farcasterAddress ?? fcAddress)
    : wagmiAddress;
  
  const walletIsConnected = isEffectivelyMiniApp 
    ? (farcasterIsConnected ?? fcIsConnected)
    : !!wagmiAddress;

  // Fetch unlock time when user has staked tokens
  const fetchUnlockTime = useCallback(async () => {
    if (!walletIsConnected || !currentAddress) return;

    try {
      const timestamp = await publicClient.readContract({
        address: toHex(stakingAddress),
        abi: stakingAbiViem,
        functionName: "depositTimestamps",
        args: [toHex(currentAddress)],
      });

      const unlockTimeStamp = Number(timestamp) + 86400; // 24 hours in seconds
      setUnlockTime(unlockTimeStamp);
    } catch (error) {
      console.error("Error fetching unlock time:", error);
      // Don't show toast error for automatic fetching, only for manual clicks
    }
  }, [currentAddress, walletIsConnected, stakingAddress]);

  // Reset unlock time when address changes
  useEffect(() => {
    setUnlockTime(null);
  }, [currentAddress, stakingAddress]);

  // Fetch unlock time automatically when user has staked tokens
  useEffect(() => {
    if (
      userStakedBalance > 0n &&
      walletIsConnected &&
      currentAddress &&
      unlockTime === null
    ) {
      fetchUnlockTime();
    }
  }, [
    userStakedBalance,
    walletIsConnected,
    currentAddress,
    unlockTime,
    fetchUnlockTime,
  ]);

  // Handle button click
  const handleButtonClick = async () => {
    if (isLoading) return;

    // Fetch unlock time if not already fetched
    if (unlockTime === null) {
      try {
        await fetchUnlockTime();
      } catch {
        toast.error("Could not fetch unlock time.");
        return;
      }
    }

    setIsModalOpen(true);
  };

  // Update timer when unlock time is set
  useEffect(() => {
    if (!unlockTime) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const secondsLeft = unlockTime - now;

      if (secondsLeft <= 0) {
        setTimeLeft("");
        return;
      }

      const hours = Math.floor(secondsLeft / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);
      const seconds = secondsLeft % 60;

      setTimeLeft(
        `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
          .toString()
          .padStart(2, "0")}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [unlockTime]);

  const isLocked = unlockTime
    ? Math.floor(Date.now() / 1000) < unlockTime
    : false;

  const handleUnstake = async (amount: bigint) => {
    if (!currentAddress || !walletIsConnected) {
      toast.error("Wallet not connected or address missing.");
      throw new Error("Wallet not connected or address missing.");
    }
    setIsLoading(true);
    const toastId = toast.loading("Preparing unstake transaction...");

    try {
      let unstakeTxHash: `0x${string}` | undefined;

      if (isEffectivelyMiniApp) {
        const ethProvider = await sdk.wallet.getEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available.");
        }

        toast.info("Requesting unstake...", { id: toastId });
        const unstakeIface = new Interface(stakingAbiEthers);
        const unstakeData = unstakeIface.encodeFunctionData("unstake", [
          toHex(currentAddress!),
          amount,
        ]);
        
        const unstakeDataWithReferral = await appendReferralTag(
          toHex(unstakeData),
          toHex(currentAddress!)
        );

        unstakeTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(stakingAddress),
              from: toHex(currentAddress!),
              data: unstakeDataWithReferral,
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });

        if (!unstakeTxHash) {
          throw new Error(
            "Unstake transaction hash not received. User might have cancelled."
          );
        }
        toast.loading("Waiting for unstake confirmation...", { id: toastId });
        const unstakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: unstakeTxHash,
        });
        if (unstakeReceipt.status !== "success") {
          throw new Error("Unstake transaction failed.");
        }
        
        // Submit referral to Divvi
        await submitDivviReferral(unstakeTxHash, 8453); // Base L2 chain ID
        
        toast.success("Unstaking successful!", { id: toastId });
      } else {
        // Desktop/Mobile Path - use wagmi/privy for transaction
        if (!currentAddress) {
          throw new Error("Wallet not connected.");
        }

        // Get provider from Privy wallets or wagmi
        let provider: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (walletClient) {
          // If wagmi wallet client is available, use it
          provider = walletClient;
        } else {
          // Fallback to Privy wallet
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

        toast.info("Requesting unstake...", { id: toastId });
        
        if (walletClient) {
          // Use wagmi wallet client for unstaking
          const { encodeFunctionData } = await import("viem");
          const unstakeData = encodeFunctionData({
            abi: stakingAbiViem,
            functionName: "unstake",
            args: [toHex(currentAddress!), amount],
          });
          
          const unstakeDataWithReferral = await appendReferralTag(
            unstakeData,
            toHex(currentAddress!)
          );
          
          unstakeTxHash = await walletClient.sendTransaction({
            to: toHex(stakingAddress),
            data: unstakeDataWithReferral,
            account: toHex(currentAddress!),
            chain: undefined,
          });
        } else {
          // Use Privy provider
          const unstakeIface = new Interface(stakingAbiEthers);
          const unstakeData = unstakeIface.encodeFunctionData("unstake", [
            toHex(currentAddress!),
            amount,
          ]);
          
          const unstakeDataWithReferral = await appendReferralTag(
            toHex(unstakeData),
            toHex(currentAddress!)
          );
          
          unstakeTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(stakingAddress),
                from: toHex(currentAddress!),
                data: unstakeDataWithReferral,
                chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
              },
            ],
          });
        }

        if (!unstakeTxHash) {
          throw new Error(
            "Unstake transaction hash not received. User might have cancelled."
          );
        }
        toast.loading("Waiting for unstake confirmation...", { id: toastId });
        const unstakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: unstakeTxHash,
        });
        if (unstakeReceipt.status !== "success") {
          throw new Error("Unstake transaction failed.");
        }
        
        // Submit referral to Divvi
        await submitDivviReferral(unstakeTxHash, 8453); // Base L2 chain ID
        
        toast.success("Unstaking successful!", { id: toastId });
      }

      // PostHog event tracking - single location for both paths
      postHog.capture(POSTHOG_EVENTS.UNSTAKE_SUCCESS, {
        [ANALYTICS_PROPERTIES.STAKING_ADDRESS]: stakingAddress,
        [ANALYTICS_PROPERTIES.AMOUNT_WEI]: amount.toString(),
        [ANALYTICS_PROPERTIES.AMOUNT_FORMATTED]: formatUnits(amount, 18),
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: currentAddress,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isEffectivelyMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: unstakeTxHash,
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isEffectivelyMiniApp ? "farcaster" : "privy",
      });

      onSuccess?.();
      setIsModalOpen(false);
    } catch (error: unknown) {
      console.error("UnstakeButton caught error:", error);
      let message = "Unstake operation failed.";
      let errorDetails = "";
      if (typeof error === "object" && error !== null) {
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error("UnstakeButton error details (stringified):", errorDetails);

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
      // Ensure the modal can handle this error correctly
      // If UnstakeModal's onUnstake expects a void promise, this is fine.
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleButtonClick}
        disabled={disabled || userStakedBalance <= 0n || isLocked || isLoading}
        className={className}
        title={timeLeft ? `Unlocks in ${timeLeft}` : undefined}
      >
        {isLoading
          ? "Processing..."
          : timeLeft
          ? `Unlock in ${timeLeft}`
          : "Unstake"}
      </button>

      <UnstakeModal
        isOpen={isModalOpen}
        onClose={() => !isLoading && setIsModalOpen(false)}
        balance={userStakedBalance}
        symbol={symbol}
        onUnstake={handleUnstake} // handleUnstake now correctly matches Promise<void>
        onSuccess={onSuccess}
      />
    </>
  );
}
