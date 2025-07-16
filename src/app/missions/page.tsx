"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { ERC20_ABI } from "@/src/lib/contracts/StremeStakingRewardsFunder";
import { getPrices } from "@/src/lib/priceUtils";
import { useStreamingNumber } from "@/src/hooks/useStreamingNumber";
import { StreamAnimation } from "@/src/components/StreamAnimation";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { HowItWorksModal } from "@/src/components/HowItWorksModal";
import { ContributionModal } from "@/src/components/ContributionModal";
import {
  useStremeStakingContract,
  useStakingContractActions,
  formatStakeAmount,
} from "@/src/hooks/useStremeStakingContract";

export default function MissionsPage() {
  const { isConnected, address: wagmiAddress } = useAccount();
  const { authenticated } = usePrivy();
  const {
    isMiniAppView,
    address: farcasterAddress,
    isConnected: farcasterIsConnected,
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

  const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
  const DEPOSIT_CONTRACT_ADDRESS = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b";
  const GOAL = 1000; // $1000 USD goal

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

  // Handle transaction completion - close modal and clear form when transaction is confirmed
  useEffect(() => {
    if (
      !isDepositing &&
      !isApproving &&
      !isWithdrawing &&
      !isConfirming &&
      hash &&
      showContributionModal &&
      !pendingDepositAmount
    ) {
      // Transaction completed successfully
      refetchUserBalance();
      refetchTotalBalance();
      setAmount("");
      setPercentage(0);
      setShowContributionModal(false);

      // Contributors will be updated by the real data fetching
    }
  }, [
    isDepositing,
    isApproving,
    isWithdrawing,
    isConfirming,
    hash,
    showContributionModal,
    pendingDepositAmount,
    refetchUserBalance,
    refetchTotalBalance,
  ]);

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
      if (withdrawAll) {
        withdrawAllTokens(isMiniAppView, effectiveAddress);
      } else {
        const amountToWithdraw = customAmount || amount;
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

  return (
    <div className="min-h-screen sm:mt-20">
      {/* Back navigation button for mini-app only */}
      {/* {isMiniAppView && (
        <div className="container mx-auto px-2 pt-4">
          <button
            onClick={() => router.push("/")}
            className="mb-4 cursor-pointer flex items-center "
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back
          </button>
        </div>
      )} */}

      <div className="container mx-auto px-1 pt-2">
        <div className="mb-2">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold uppercase text-base-600 my-2">
              Stake to fund. Earn $SUP.
            </h2>
            {/* Info button in top right */}
            <button
              onClick={() => setShowHowItWorks(true)}
              className="btn btn-ghost btn-sm btn-circle bg-base-100/80 backdrop-blur-sm"
              title="How it works"
            >
              <svg
                className="w-5 h-5"
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
          <h1 className="text-sm text-base-600 mb-1">
            Redistribute your staking rewards to fund bullish initiatives and
            earn $SUP for your contributions. Withdraw your stake anytime.
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-1">
        {/* Combined Animation and Contribution Section */}
        <div className="mb-4">
          {effectiveIsConnected ? (
            <div className="sm:p-6">
              {/* Animation and Balance Display */}
              <div className="mb-4">
                <StreamAnimation
                  contributorCount={0}
                  growthRate={Math.max(stremeGrowthRate, 0.1)}
                />
                <div className="text-center">
                  <h3 className="text-sm uppercase text-primary font-bold mt-4">
                    Initiative
                  </h3>
                  <h2 className="text-base uppercase text-base-600">
                    Help Streme win a QR Auction
                  </h2>
                </div>

                {/* Progress Chart */}
                <div className="mt-4 bg-base-100 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg sm:text-xl font-bold font-mono text-primary">
                        {price ? (
                          <>
                            $
                            {totalUsdValue.toLocaleString("en-US", {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4,
                            })}
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <span>$</span>
                            <div className="h-6 w-16 bg-base-300 rounded animate-pulse"></div>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-base-content/70">Raised</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg sm:text-xl font-bold font-mono">
                        {totalStremeAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-xs text-base-content/70">STREME</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg sm:text-xl font-bold">
                        {progressPercentage.toFixed(0)}%
                      </div>
                      <div className="text-xs text-base-content/70">
                        Complete
                      </div>
                    </div>
                  </div>

                  <div className="w-full bg-base-300 rounded-full h-3 mb-2">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono">
                      $
                      {remainingUsd.toLocaleString("en-US", {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      })}{" "}
                      to $1,000 goal
                    </span>
                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <div className="badge badge-success badge-sm">
                          ✅ Goal Reached!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>


              {/* Current Contribution Status */}
              {hasActiveContribution && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base">
                      Your Active Redirect
                    </h3>
                    <div className="badge badge-primary badge-sm">
                      {userPercentage}% of pool
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-base-content/70">
                      Staked STREME
                    </p>
                    <p className="font-bold font-mono">{userContribution}</p>
                  </div>
                </div>
              )}

              {/* Contribute Button */}
              {effectiveAuthenticated && (
                <div className="text-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Small delay to prevent immediate close
                      setTimeout(() => {
                        setShowContributionModal(true);
                      }, 10);
                    }}
                    className="btn btn-primary btn-lg w-full"
                  >
                    {hasActiveContribution
                      ? "Add / Withdraw"
                      : "Redirect Rewards"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-base-200 rounded-xl sm:p-6">
              {/* Animation and Balance Display */}
              <div className="mb-4">
                <StreamAnimation
                  contributorCount={0}
                  growthRate={Math.max(stremeGrowthRate, 0.1)}
                />
                <div className="flex justify-between items-start mt-3">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold font-mono">
                      {totalStremeAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      STREME
                    </div>
                    <div className="text-lg sm:text-xl font-semibold font-mono text-primary">
                      {price ? (
                        <>
                          $
                          {totalUsdValue.toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span>$</span>
                          <div className="h-6 w-16 bg-base-300 rounded animate-pulse"></div>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-base-content/70 mt-1">
                      {progressPercentage.toFixed(0)}% of $1,000 goal
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="alert mb-4">
                  <span>Connect your wallet to join the mission</span>
                </div>
                <button className="btn btn-primary btn-lg w-full" disabled>
                  Redirect Rewards
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contribution Modal */}
      <ContributionModal
        isOpen={showContributionModal}
        onClose={() => {
          setShowContributionModal(false);
          setError("");
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
      />

      {/* How It Works Modal */}
      <HowItWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
        isMiniApp={isMiniAppView}
      />
    </div>
  );
}
