"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { ERC20_ABI } from "@/src/lib/contracts/StremeStakingRewardsFunder";
import { getPrices } from "@/src/lib/priceUtils";
import { useStreamingNumber } from "@/src/hooks/useStreamingNumber";
import { StreamAnimation } from "@/src/components/StreamAnimation";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { HowCrowdfundWorksModal } from "@/src/components/HowCrowdfundWorksModal";
import { ContributionModal } from "@/src/components/ContributionModal";
import {
  useStremeStakingContract,
  useStakingContractActions,
  formatStakeAmount,
} from "@/src/hooks/useStremeStakingContract";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import sdk from "@farcaster/miniapp-sdk";
import { publicClient } from "@/src/lib/viemClient";

export default function CrowdfundPage() {
  const { isConnected, address: wagmiAddress } = useAccount();
  const { authenticated } = usePrivy();
  const router = useRouter();
  const {
    isMiniAppView,
    address: farcasterAddress,
    isConnected: farcasterIsConnected,
    isSDKLoaded,
  } = useAppFrameLogic();
  const [price, setPrice] = useState<number | null>(null);
  const [baseUsdValue, setBaseUsdValue] = useState<number>(0);
  const [lastUsdUpdateTime, setLastUsdUpdateTime] = useState<number>(
    Date.now()
  );
  const [amount, setAmount] = useState("");
  const [percentage, setPercentage] = useState(0);
  const [error, setError] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [pendingDepositAmount, setPendingDepositAmount] = useState("");
  const [contributors, setContributors] = useState<
    Array<{
      address: string;
      amount: string;
      username: string;
      pfp_url: string;
      percentage?: number;
    }>
  >([]);
  const [isLoadingContributors, setIsLoadingContributors] = useState(true);
  const [isRefreshingAfterTransaction, setIsRefreshingAfterTransaction] =
    useState(false);
  const [isTransactionSuccess, setIsTransactionSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState("");
  const [successPercentage, setSuccessPercentage] = useState("");
  const [isWithdrawalSuccess, setIsWithdrawalSuccess] = useState(false);
  const [lastTransactionType, setLastTransactionType] = useState<
    "contribution" | "withdrawal" | null
  >(null);
  const [lastWithdrawAmount, setLastWithdrawAmount] = useState("");
  const [unlockTime, setUnlockTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
  const DEPOSIT_CONTRACT_ADDRESS = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b";
  const GOAL = 1000; // $1000 USD goal

  // ABI for the staking contract to check deposit timestamps
  const stakingAbi = useMemo(
    () =>
      [
        {
          name: "depositTimestamps",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ] as const,
    []
  );

  // Effective connection status for mini-app vs regular
  const effectiveIsConnected = isMiniAppView
    ? farcasterIsConnected
    : isConnected;
  const effectiveAuthenticated = isMiniAppView
    ? farcasterIsConnected
    : authenticated;
  const effectiveAddress = isMiniAppView ? farcasterAddress : wagmiAddress;

  // Read STREME token balance
  const { data: stremeBalance } = useReadContract({
    address: STREME_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [DEPOSIT_CONTRACT_ADDRESS as `0x${string}`],
  });

  // User staking info
  const {
    userDepositBalance,
    totalBalance,
    isPaused,
    userStakedTokenBalance,
    userAllowance,
    refetchUserBalance,
    refetchTotalBalance,
    refetchAllowance,
    refetchUserStakedTokenBalance,
    stakedStremeCoinAddress,
  } = useStremeStakingContract(effectiveAddress);

  const {
    approveTokens,
    depositTokens,
    withdrawTokens,
    withdrawAllTokens,
    isApproving,
    isDepositing,
    isWithdrawing,
    isConfirming,
    error: contractError,
    hash,
  } = useStakingContractActions(effectiveAddress);

  // Animated balance state
  const [baseStremeAmount, setBaseStremeAmount] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // State for real flow rate data
  const [realFlowRate, setRealFlowRate] = useState<number>(0);

  // Fetch real flow rate from Superfluid subgraph
  useEffect(() => {
    const fetchFlowRate = async () => {
      try {
        const stakingPoolAddress = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b"; // The staking pool address

        const query = `
          query PoolData {
            pool(id: "${stakingPoolAddress.toLowerCase()}") {
              flowRate
            }
          }
        `;

        const response = await fetch(
          "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          }
        );

        const data = await response.json();
        if (data.data?.pool?.flowRate) {
          // Convert flow rate from wei per second to tokens per second
          const flowRatePerSecond = Number(
            formatUnits(BigInt(data.data.pool.flowRate), 18)
          );
          setRealFlowRate(flowRatePerSecond);
        }
      } catch (error) {
        console.error("Error fetching flow rate:", error);
        // Fallback to simulated rate
        setRealFlowRate(1.0);
      }
    };

    fetchFlowRate();
    // Refetch every 60 seconds
    const interval = setInterval(fetchFlowRate, 60000);
    return () => clearInterval(interval);
  }, []);

  // Use real flow rate or fallback to simulated calculation
  const stremeGrowthRate = useMemo(() => {
    if (realFlowRate > 0) {
      return realFlowRate; // Use actual Superfluid flow rate
    }

    // Fallback simulation if real flow rate is not available
    if (!totalBalance) return 1.0;
    const balanceInEth = Number(totalBalance) / 1e18;
    const dailyGrowthRate = balanceInEth * 0.001;
    const baseFlowRatePerSecond = dailyGrowthRate / 86400;
    // Use a fixed activity multiplier since we removed contributors
    const activityMultiplier = 2;
    return Math.max(baseFlowRatePerSecond * activityMultiplier, 0.1);
  }, [realFlowRate, totalBalance]);

  const animatedStremeBalance = useStreamingNumber({
    baseAmount: baseStremeAmount,
    flowRatePerSecond: stremeGrowthRate,
    lastUpdateTime,
    updateInterval: 50, // Match StakedBalance component for consistency
    pauseWhenHidden: true,
  });

  // Calculate USD growth rate (price * token growth rate)
  const usdGrowthRate = price ? stremeGrowthRate * price : 0;

  const animatedUsdValue = useStreamingNumber({
    baseAmount: baseUsdValue,
    flowRatePerSecond: usdGrowthRate,
    lastUpdateTime: lastUsdUpdateTime,
    updateInterval: 50,
    pauseWhenHidden: true,
  });

  // Update balance
  useEffect(() => {
    if (!stremeBalance) return;
    const currentBalance = Number(stremeBalance) / 1e18;

    // Check if this is a significant change (more than 0.1% difference)
    const percentChange =
      Math.abs(currentBalance - baseStremeAmount) /
      Math.max(baseStremeAmount, 1);
    if (percentChange > 0.001) {
      setBaseStremeAmount(currentBalance);
      setLastUpdateTime(Date.now());

      // Update USD value if price is available
      if (price) {
        setBaseUsdValue(currentBalance * price);
        setLastUsdUpdateTime(Date.now());
      }
    }
  }, [stremeBalance, baseStremeAmount, price]);

  // Fetch price - optimized for faster loading
  useEffect(() => {
    const fetchPrice = async (retryCount = 0) => {
      try {
        const prices = await getPrices([STREME_TOKEN_ADDRESS]);
        if (prices?.[STREME_TOKEN_ADDRESS.toLowerCase()]) {
          const newPrice = prices[STREME_TOKEN_ADDRESS.toLowerCase()];
          setPrice(newPrice);

          // Update USD value immediately when price becomes available
          if (baseStremeAmount > 0) {
            setBaseUsdValue(baseStremeAmount * newPrice);
            setLastUsdUpdateTime(Date.now());
          }
        } else if (retryCount < 3) {
          // Retry up to 3 times with shorter delays
          setTimeout(() => fetchPrice(retryCount + 1), 1000);
        }
      } catch (error) {
        console.error("Error fetching price:", error);
        if (retryCount < 3) {
          // Retry with exponential backoff
          setTimeout(
            () => fetchPrice(retryCount + 1),
            Math.pow(2, retryCount) * 1000
          );
        }
      }
    };

    fetchPrice();

    // Refresh price every 30 seconds for more up-to-date values
    const interval = setInterval(() => fetchPrice(), 30000);
    return () => clearInterval(interval);
  }, [baseStremeAmount]);

  // Fetch contributors leaderboard
  const fetchContributors = useCallback(async (bustCache = false) => {
    try {
      console.log(
        "Fetching contributors from API...",
        bustCache ? "(cache busting)" : ""
      );
      setIsLoadingContributors(true);

      // Add cache busting when explicitly requested
      const url = bustCache
        ? `/api/crowdfund/leaderboard?t=${Date.now()}`
        : "/api/crowdfund/leaderboard";

      const response = await fetch(url, {
        cache: bustCache ? "no-store" : "default",
        headers: bustCache ? { "Cache-Control": "no-cache" } : {},
      });

      console.log("Contributors API response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Contributors data:", data);
        setContributors(data);
      } else {
        console.error("Contributors API failed with status:", response.status);
      }
    } catch (error) {
      console.error("Error fetching contributors:", error);
    } finally {
      setIsLoadingContributors(false);
    }
  }, []);

  // Fetch contributors with retry logic for transaction updates
  const fetchContributorsWithRetry = useCallback(async () => {
    console.log("Fetching contributors after transaction with retry logic...");
    setIsRefreshingAfterTransaction(true);

    // First attempt - immediate refresh with cache busting
    await fetchContributors(true);

    // If external API is slow to update, retry with delays
    setTimeout(() => {
      console.log("Retry 1: Fetching contributors after 2 seconds...");
      fetchContributors(true);
    }, 2000);

    setTimeout(() => {
      console.log("Retry 2: Fetching contributors after 5 seconds...");
      fetchContributors(true);
      setIsRefreshingAfterTransaction(false); // Stop showing refresh indicator after final retry
    }, 5000);
  }, [fetchContributors]);

  useEffect(() => {
    fetchContributors();
    // Refresh contributors every 20 seconds
    const interval = setInterval(fetchContributors, 20000);
    return () => clearInterval(interval);
  }, [fetchContributors]);

  // Handle approval completion - proceed to deposit
  useEffect(() => {
    if (!isApproving && !isConfirming && hash && pendingDepositAmount) {
      // Approval completed, now proceed to deposit
      console.log("Approval completed, proceeding to deposit");
      refetchAllowance(); // Refresh allowance
      depositTokens(pendingDepositAmount, isMiniAppView, effectiveAddress);
      setPendingDepositAmount(""); // Clear pending amount
    }
  }, [
    isApproving,
    isConfirming,
    hash,
    pendingDepositAmount,
    refetchAllowance,
    depositTokens,
    isMiniAppView,
    effectiveAddress,
  ]);

  // Handle contract errors - reset pending state and show error
  useEffect(() => {
    if (contractError) {
      console.log("Contract error detected:", contractError);
      setPendingDepositAmount(""); // Reset pending state

      // Set user-friendly error message
      let errorMessage = "Transaction failed";
      if (contractError.message) {
        if (
          contractError.message.includes("User rejected") ||
          contractError.message.includes("rejected") ||
          contractError.message.includes("cancelled")
        ) {
          errorMessage = "Transaction cancelled";
        } else {
          errorMessage = contractError.message.substring(0, 100);
        }
      }
      setError(errorMessage);
    }
  }, [contractError]);

  // Track if we've processed this hash to avoid closing modal on re-render
  const [processedHash, setProcessedHash] = useState<string | null>(null);

  // Handle transaction completion - close modal and clear form when transaction is confirmed
  useEffect(() => {
    if (
      !isDepositing &&
      !isApproving &&
      !isWithdrawing &&
      !isConfirming &&
      hash &&
      showContributionModal &&
      !pendingDepositAmount &&
      hash !== processedHash
    ) {
      // Transaction completed successfully
      const isWithdrawal = lastTransactionType === "withdrawal";
      const transactionAmount = isWithdrawal
        ? lastWithdrawAmount
        : amount || "0";

      // Refetch balances to get updated values
      refetchUserBalance();
      refetchTotalBalance();
      refetchUserStakedTokenBalance();

      // Fetch updated contributors leaderboard with retry logic
      fetchContributorsWithRetry();

      // Set success state with the amount
      setSuccessAmount(transactionAmount);
      setIsWithdrawalSuccess(isWithdrawal);
      setIsTransactionSuccess(true);

      // The percentage will be calculated after refetch completes
      // We'll use a separate effect to update the percentage once new balance is available

      setAmount("");
      setPercentage(0);
      setLastWithdrawAmount("");
      setLastTransactionType(null);
      setProcessedHash(hash);
    }
  }, [
    isDepositing,
    isApproving,
    isWithdrawing,
    isConfirming,
    hash,
    showContributionModal,
    pendingDepositAmount,
    processedHash,
    refetchUserBalance,
    refetchTotalBalance,
    refetchUserStakedTokenBalance,
    fetchContributorsWithRetry,
    amount,
    totalBalance,
    lastTransactionType,
    lastWithdrawAmount,
  ]);

  // Update success percentage when balances are updated and we're in success state
  useEffect(() => {
    if (
      isTransactionSuccess &&
      userDepositBalance &&
      totalBalance &&
      totalBalance > 0n
    ) {
      const updatedPercentage = (
        (Number(userDepositBalance) / Number(totalBalance)) *
        100
      ).toFixed(1);
      setSuccessPercentage(updatedPercentage);
    }
  }, [isTransactionSuccess, userDepositBalance, totalBalance]);

  // Fetch unlock time when user has staked tokens
  const fetchUnlockTime = useCallback(async () => {
    if (!effectiveIsConnected || !effectiveAddress || !stakedStremeCoinAddress)
      return;

    try {
      const timestamp = await publicClient.readContract({
        address: stakedStremeCoinAddress as `0x${string}`,
        abi: stakingAbi,
        functionName: "depositTimestamps",
        args: [effectiveAddress as `0x${string}`],
      });

      const unlockTimeStamp = Number(timestamp) + 86400; // 24 hours in seconds
      setUnlockTime(unlockTimeStamp);
    } catch (error) {
      console.error("Error fetching unlock time:", error);
    }
  }, [
    effectiveIsConnected,
    effectiveAddress,
    stakedStremeCoinAddress,
    stakingAbi,
  ]);

  // Fetch unlock time automatically when user has staked tokens
  useEffect(() => {
    if (
      userStakedTokenBalance &&
      userStakedTokenBalance > 0n &&
      effectiveIsConnected &&
      effectiveAddress &&
      stakedStremeCoinAddress &&
      unlockTime === null
    ) {
      fetchUnlockTime();
    }
  }, [
    userStakedTokenBalance,
    effectiveIsConnected,
    effectiveAddress,
    stakedStremeCoinAddress,
    unlockTime,
    fetchUnlockTime,
  ]);

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

  // Check if tokens are locked
  const isLocked = unlockTime
    ? Math.floor(Date.now() / 1000) < unlockTime
    : false;

  // Contributors are now fetched from real contract data above

  // Calculate values
  const totalStremeAmount = animatedStremeBalance;
  const totalUsdValue = price ? animatedUsdValue : 0;
  const progressPercentage = (totalUsdValue / GOAL) * 100;
  const remainingUsd = Math.max(0, GOAL - totalUsdValue);
  const isCompleted = totalUsdValue >= GOAL;

  // User contribution calculations
  const userContribution = formatStakeAmount(userDepositBalance);
  const userPercentage =
    userDepositBalance && totalBalance && totalBalance > 0n
      ? ((Number(userDepositBalance) / Number(totalBalance)) * 100).toFixed(1)
      : "0";

  // Check if user has active contribution
  const hasActiveContribution = Boolean(
    userDepositBalance && userDepositBalance > 0n
  );

  const handleContribute = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setError("");

      // Check if we need approval first
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 1e18));

      if (!userAllowance || userAllowance < amountBigInt) {
        console.log("Need approval first");
        setPendingDepositAmount(amount); // Store amount for after approval
        approveTokens(amount, isMiniAppView, effectiveAddress);
        // Don't close modal yet - wait for approval to complete
        return;
      }

      // Then deposit (if already approved)
      setLastTransactionType("contribution");
      depositTokens(amount, isMiniAppView, effectiveAddress);
      // Don't close modal yet - wait for deposit to complete
    } catch (err) {
      console.error("Contribution error:", err);
      setError(err instanceof Error ? err.message : "Contribution failed");
    }
  };

  const handleWithdraw = async (
    withdrawAll: boolean = false,
    customAmount?: string
  ) => {
    try {
      setError("");
      setLastTransactionType("withdrawal");

      if (withdrawAll) {
        // For withdraw all, we'll use the current user deposit balance
        setLastWithdrawAmount(formatStakeAmount(userDepositBalance));
        withdrawAllTokens(isMiniAppView, effectiveAddress);
      } else {
        const amountToWithdraw = customAmount || amount;
        setLastWithdrawAmount(amountToWithdraw);
        withdrawTokens(amountToWithdraw, isMiniAppView, effectiveAddress);
      }
      // Don't close modal yet - wait for withdrawal to complete
    } catch (err) {
      console.error("Withdrawal error:", err);
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    }
  };

  // Calculate amount based on percentage
  const calculateAmountFromPercentage = (percent: number): string => {
    if (!userStakedTokenBalance) return "0";
    const balance = Number(formatUnits(userStakedTokenBalance, 18));
    const calculatedAmount = (balance * percent) / 100;
    return calculatedAmount.toFixed(2);
  };

  // Handle slider change
  const handleSliderChange = (value: number) => {
    setPercentage(value);
    setAmount(calculateAmountFromPercentage(value));
  };

  // Handle manual amount change
  const handleAmountChange = (value: string) => {
    setAmount(value);
    // Calculate percentage from amount
    if (userStakedTokenBalance && value) {
      const balance = Number(formatUnits(userStakedTokenBalance, 18));
      const newPercentage =
        balance > 0 ? (parseFloat(value) / balance) * 100 : 0;
      setPercentage(Math.min(100, Math.max(0, newPercentage)));
    } else {
      setPercentage(0);
    }
  };

  // Utility function to truncate addresses
  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle sharing to Farcaster
  const handleShareToFarcaster = async () => {
    const shareUrl = `https://streme.fun/crowdfund`;
    const shareText = `I just contributed ${successAmount} STREME to @streme's streaming QR crowdfund! Streme On 🎶 🚀`;

    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: shareText,
          embeds: [shareUrl],
        });
      } catch (error) {
        console.error("Error composing cast:", error);
        // Fallback to opening Farcaster
        window.open(
          `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
            shareText
          )}&embeds%5B%5D=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
      }
    } else {
      // Desktop version - open Farcaster web compose
      window.open(
        `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
          shareText
        )}&embeds%5B%5D=${encodeURIComponent(shareUrl)}`,
        "_blank"
      );
    }
  };

  // Format contributor amount
  const formatContributorAmount = (amountWei: string) => {
    const amount = Number(formatUnits(BigInt(amountWei), 18));
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(0);
  };

  return (
    <div
      className={`min-h-screen sm:mt-24 sm:max-w-xl mx-auto ${
        isMiniAppView ? "pb-24" : "pb-4"
      }`}
    >
      {/* Back Button - Only show in mini app */}
      {isMiniAppView && (
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
        </div>
      )}

      <div className="container mx-auto px-4">
        <div className="mb-1">
          <div className="flex justify-between items-start">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-1 justify-between">
                <h2 className="text-lg md:text-xl font-bold text-base-content">
                  Win a QR Auction for Streme
                </h2>
                {/* Info button in top right */}
                <button
                  onClick={() => setShowHowItWorks(true)}
                  className="btn btn-ghost btn-sm btn-circle ml-2 flex-shrink-0"
                  title="How it works"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Image
                  src="https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/46c48fa8-50e2-47a6-b46c-efdaed372500/original"
                  alt="Zeni"
                  width={20}
                  height={20}
                  className="rounded-full"
                />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-base-content/70 leading-snug">
                    by
                  </span>
                  <Link
                    href="https://farcaster.xyz/zeni.eth"
                    className="text-sm text-base-content/70 leading-snug hover:underline"
                  >
                    zeni.eth
                  </Link>
                </div>
              </div>
              <p className="text-sm text-base-content/70 leading-snug">
                Help Streme get discovered by 10,000+ quality users via QR
                Auction. Contribute your staking $STREME yield to earn SUP
                rewards.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto">
        {/* Combined Animation and Contribution Section */}
        <div className="mb-3">
          {effectiveIsConnected ? (
            <div>
              {/* Streaming Animation with Token Count - Hero Position */}
              <div className="text-center mb-2">
                <StreamAnimation
                  contributorCount={0}
                  growthRate={Math.max(stremeGrowthRate, 0.1)}
                />
                {/* Animated STREME Balance Display */}
                <div className="mt-1 mb-1">
                  <div className="text-center">
                    <div className="text-2xl font-bold font-mono text-primary">
                      {totalStremeAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      STREME
                    </div>

                    <div className="text-xs text-base-content/60">
                      pooled so far
                    </div>
                  </div>
                </div>
              </div>

              {/* Ultra-Compact Goal and Progress Section */}
              <div className="bg-base-100 rounded-lg p-3 shadow-sm border border-base-200 mb-2">
                {/* Enhanced Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {progressPercentage.toFixed(0)}%
                      </div>
                      <div className="text-xs text-base-content/60">
                        complete
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-primary">
                        {(totalStremeAmount / 1000000).toLocaleString("en-US", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        M STREME
                      </div>
                      <div className="text-sm font-bold text-base-content">
                        {price
                          ? `($${totalUsdValue.toLocaleString("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })} USD)`
                          : "Loading..."}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-base-300 rounded-full h-4 mb-2">
                    <div
                      className="h-4 rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                      style={{
                        width: `${Math.min(progressPercentage, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Minimal Goal Status */}
                <div className="text-center text-xs text-base-content/60">
                  $
                  {remainingUsd.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  to $1,000 goal
                  {isCompleted && <span className="text-success ml-1">✅</span>}
                </div>
              </div>

              {/* CTA Button - Above the fold */}
              {effectiveAuthenticated && (
                <div className="mb-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeout(() => {
                        setShowContributionModal(true);
                      }, 100);
                    }}
                    disabled={isPaused || isLocked}
                    className="btn btn-primary btn-lg w-full h-11 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    title={
                      timeLeft
                        ? `Staked tokens unlock in ${timeLeft}`
                        : undefined
                    }
                  >
                    {isPaused ? (
                      "Crowdfund Paused"
                    ) : isLocked ? (
                      `Staked tokens unlock in ${timeLeft}`
                    ) : hasActiveContribution ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Manage Contribution
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Contribute STREME
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* Current Contribution Status */}
              {hasActiveContribution && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm">Your Contribution</h3>
                    <div className="badge badge-primary badge-sm">
                      {userPercentage}%
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-base-content/70">
                      Contributing STREME (yield only • tokens stay yours)
                    </p>
                    <p className="font-bold font-mono">{userContribution}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Streaming Animation with Token Count - Hero Position */}
              <div className="text-center mb-3">
                <StreamAnimation
                  contributorCount={0}
                  growthRate={Math.max(stremeGrowthRate, 0.1)}
                />
                {/* Animated STREME Balance Display */}
                <div className="mt-2 mb-1">
                  <div className="text-center">
                    <div className="text-3xl font-bold font-mono text-primary">
                      {totalStremeAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      STREME
                    </div>
                    <div className="text-lg font-bold text-success mt-1">
                      {price
                        ? `($${totalUsdValue.toLocaleString("en-US", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })} USD)`
                        : "Loading price..."}
                    </div>
                    <div className="text-xs text-base-content/60 mt-1">
                      pooled for front page exposure
                    </div>
                  </div>
                </div>
              </div>

              {/* Ultra-Compact Goal and Progress Section */}
              <div className="bg-base-100 rounded-lg p-3 shadow-sm border border-base-200 mb-3">
                {/* Enhanced Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {progressPercentage.toFixed(0)}%
                      </div>
                      <div className="text-xs text-base-content/60">
                        complete
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono text-primary">
                        {(totalStremeAmount / 1000000).toLocaleString("en-US", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        M STREME
                      </div>
                      <div className="text-sm font-bold text-base-content">
                        {price
                          ? `($${totalUsdValue.toLocaleString("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })} USD)`
                          : "Loading..."}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-base-300 rounded-full h-4 mb-2">
                    <div
                      className="h-4 rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                      style={{
                        width: `${Math.min(progressPercentage, 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Minimal Goal Status */}
                <div className="text-center text-xs text-base-content/60">
                  $
                  {remainingUsd.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  to $1,000 goal
                  {isCompleted && <span className="text-success ml-1">✅</span>}
                </div>
              </div>

              {/* CTA Button - Above the fold */}
              <div className="mb-3">
                <div className="alert mb-3 bg-base-200/50 border-base-300">
                  <svg
                    className="w-4 h-4 text-base-content/70"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm">
                    Connect your wallet to join the crowdfund
                  </span>
                </div>
                <button
                  className="btn btn-primary btn-lg w-full h-11 text-base font-semibold opacity-60"
                  disabled
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Join the Fund
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contributors Leaderboard */}
      {(contributors.length > 0 || isLoadingContributors) && (
        <div className="container mx-auto mt-6 mb-8">
          <div className="">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Contributors</h3>
              <div className="flex items-center gap-2">
                {isRefreshingAfterTransaction && (
                  <div className="flex items-center gap-1">
                    <div className="loading loading-spinner loading-xs"></div>
                    <span className="text-xs text-base-content/60">
                      Updating...
                    </span>
                  </div>
                )}
                <button
                  onClick={() => fetchContributors(true)}
                  disabled={
                    isLoadingContributors || isRefreshingAfterTransaction
                  }
                  className="btn btn-ghost btn-xs"
                  title="Refresh leaderboard"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {isLoadingContributors && contributors.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="loading loading-spinner loading-md"></div>
                </div>
              ) : (
                contributors
                  .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)))
                  .slice(0, 10)
                  .map((contributor, index) => (
                    <div
                      key={contributor.address}
                      className="flex items-center justify-between p-3 bg-base-200/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          {contributor.pfp_url ? (
                            <Image
                              src={contributor.pfp_url}
                              alt={contributor.username || "Contributor"}
                              width={24}
                              height={24}
                              className="rounded-full"
                              unoptimized={
                                contributor.pfp_url.includes(".gif") ||
                                contributor.pfp_url.includes(
                                  "imagedelivery.net"
                                )
                              }
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                              {contributor.username
                                ? contributor.username.charAt(0).toUpperCase()
                                : contributor.address.slice(2, 4).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium">
                              {contributor.username ||
                                truncateAddress(contributor.address)}
                            </div>
                            {contributor.username && (
                              <div className="text-xs text-base-content/60">
                                {truncateAddress(contributor.address)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm">
                          {formatContributorAmount(contributor.amount)} stSTREME
                        </div>
                        {contributor.percentage !== undefined && (
                          <div className="text-xs text-base-content/60">
                            {contributor.percentage.toFixed(1)}% of pool
                          </div>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
            {contributors.length > 10 && (
              <div className="text-center mt-3 text-sm text-base-content/60">
                Showing top 10 contributors
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      <ContributionModal
        isOpen={showContributionModal}
        onClose={() => {
          setShowContributionModal(false);
          setError("");
          setIsTransactionSuccess(false);
          setSuccessAmount("");
          setSuccessPercentage("");
          setIsWithdrawalSuccess(false);
        }}
        hasActiveContribution={hasActiveContribution}
        userContribution={userContribution}
        error={error}
        amount={amount}
        percentage={percentage}
        userStakedTokenBalance={userStakedTokenBalance}
        isApproving={isApproving}
        isDepositing={isDepositing}
        isWithdrawing={isWithdrawing}
        isConfirming={isConfirming}
        isPaused={isPaused || false}
        hash={hash || undefined}
        onAmountChange={handleAmountChange}
        onSliderChange={handleSliderChange}
        onContribute={handleContribute}
        onWithdraw={handleWithdraw}
        isMiniApp={isMiniAppView}
        isSuccess={isTransactionSuccess}
        successAmount={successAmount}
        successPercentage={successPercentage}
        onShareToFarcaster={
          !isWithdrawalSuccess ? handleShareToFarcaster : undefined
        }
        isWithdrawal={isWithdrawalSuccess}
      />

      {/* FAQ Section */}
      <div className="container mx-auto mt-8 mb-8">
        <div className="bg-base-100 ">
          <h2 className="text-xl font-bold mb-6 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" defaultChecked />
              <div className="collapse-title font-semibold">
                What is a QR auction?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  QR runs a daily auction, where the winner chooses the link the
                  QR code will point to for a day. It&apos;s a great way to
                  drive attention to anything on the internet. Around 10,000
                  people check out our winners every day. Learn more at{" "}
                  <a
                    href="https://qrcoin.fun/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary"
                  >
                    QR Coin
                  </a>{" "}
                  or from{" "}
                  <a
                    href="https://farcaster.xyz/jake"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Jake on Farcaster
                  </a>
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                How do Streme crowdfunds work?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  When you stake STREME tokens, they generate yield aka rewards.
                  By staking your STREME in the crowdfund contract, you
                  temporarily redirect that yield to the QR auction fund. There
                  are no locks and you can withdraw your staked STREME anytime.
                </p>
              </div>
            </div>
            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                Is this sufficiently decentralized?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  No, zeni.eth is the benevolent dictator of this crowdfund.
                  However, if Streme crowdfunds work well, there&apos;s nothing
                  stopping us from doing more and opening them up to other
                  Streme-lauched tokens.
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                What are SUP rewards?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  $SUP is the Superfluid token. Fund contributors earn increases
                  in SUP flow rate based on their contribution size. Be sure to
                  claim daily to update your flow rate.
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                Can I get my staked Streme back?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  Yes, you can withdraw your full principal at any time. Your
                  Streme rewards will go back to your wallet.
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                What happens if we win the auction?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  STREME gets featured on QR Coin&apos;s homepage for 24 hours,
                  exposing our project to thousands of potential investors and
                  users. This visibility typically leads to increased trading
                  volume and token adoption.
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                How long does the crowdfund last?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  The crowdfund continues until we win the auction. $1000 is
                  just a conservative target and we might not need to go all the
                  the way there. Contributors can withdraw anytime and will get
                  their staked STREME after the auction win regardless.
                </p>
              </div>
            </div>
            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                How do I know how much I&apos;m contributing?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  We don&apos;t have detailed stats individual flow rate
                  contributions yet, but we can see how much STREME you&apos;ve
                  staked.
                </p>
              </div>
            </div>
            <div className="collapse collapse-arrow bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title font-semibold">
                I just topped up my $STREME stake. How do I contribute?
              </div>
              <div className="collapse-content">
                <p className="text-sm text-base-content/70 pt-2">
                  Wait until your lock expires (24 hours after staking). No need
                  to unstake, the lock just can&apos;t be active while you
                  contribute. The button will show a countdown timer if your
                  tokens are still locked.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How Crowdfund Works Modal */}
      <HowCrowdfundWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
        isMiniApp={isMiniAppView}
      />
    </div>
  );
}
