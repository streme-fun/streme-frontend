"use client";

import { useEffect, useState } from "react";
import { formatStakeAmount } from "@/src/hooks/useStremeStakingContract";

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasActiveContribution: boolean;
  userContribution: string;
  error: string;
  amount: string;
  percentage: number;
  userStakedTokenBalance: bigint | undefined;
  isApproving: boolean;
  isDepositing: boolean;
  isWithdrawing: boolean;
  isConfirming: boolean;
  isPaused: boolean;
  hash: string | undefined;
  onAmountChange: (value: string) => void;
  onSliderChange: (value: number) => void;
  onContribute: () => void;
  onWithdraw: (withdrawAll: boolean, customAmount?: string) => void;
  isMiniApp?: boolean;
  onTransactionSuccess?: (amount: string, percentage: string) => void;
  isSuccess?: boolean;
  successAmount?: string;
  successPercentage?: string;
  onShareToFarcaster?: () => void;
  isWithdrawal?: boolean;
  // Dynamic token properties
  tokenSymbol?: string;
  tokenName?: string;
  fundTitle?: string;
}

export function ContributionModal({
  isOpen,
  onClose,
  hasActiveContribution,
  userContribution,
  error,
  amount,
  percentage,
  userStakedTokenBalance,
  isApproving,
  isDepositing,
  isWithdrawing,
  isConfirming,
  isPaused,
  onAmountChange,
  onSliderChange,
  onContribute,
  onWithdraw,
  isMiniApp = false,
  isSuccess = false,
  successAmount,
  successPercentage,
  onShareToFarcaster,
  isWithdrawal = false,
  tokenSymbol = "STREME",
  fundTitle = "Streme Growth Fund",
}: ContributionModalProps) {
  const [activeTab, setActiveTab] = useState<"add" | "withdraw">("add");
  const [withdrawPercentage, setWithdrawPercentage] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isBackdropClickable, setIsBackdropClickable] = useState(false);

  // Helper function to calculate withdraw amount from percentage of current contribution
  const calculateWithdrawAmountFromPercentage = (percent: number): string => {
    if (!hasActiveContribution) return "0";
    // Parse the current contribution amount (remove commas and convert to number)
    const currentAmount = parseFloat(userContribution.replace(/,/g, ""));
    const withdrawAmount = (currentAmount * percent) / 100;
    return withdrawAmount.toFixed(2);
  };

  // Helper function to calculate withdraw percentage from amount
  const calculateWithdrawPercentageFromAmount = (amount: string): number => {
    if (!hasActiveContribution || !amount) return 0;
    const currentAmount = parseFloat(userContribution.replace(/,/g, ""));
    const amountValue = parseFloat(amount);
    if (currentAmount <= 0) return 0;
    return Math.min(100, Math.max(0, (amountValue / currentAmount) * 100));
  };

  // Handle withdraw slider change
  const handleWithdrawSliderChange = (value: number) => {
    setWithdrawPercentage(value);
    setWithdrawAmount(calculateWithdrawAmountFromPercentage(value));
  };

  // Handle withdraw amount change
  const handleWithdrawAmountChange = (value: string) => {
    setWithdrawAmount(value);
    setWithdrawPercentage(calculateWithdrawPercentageFromAmount(value));
  };
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Delay backdrop clickability to prevent accidental closes on mobile
      setIsBackdropClickable(false);
      const timer = setTimeout(() => {
        setIsBackdropClickable(true);
      }, 300);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "unset";
      };
    } else {
      document.body.style.overflow = "unset";
      setIsBackdropClickable(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${
        isMiniApp ? "flex items-end" : "flex items-center justify-center"
      }`}
      style={{ zIndex: 10000 }}
    >
      {/* Subtle backdrop for click-to-close */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
        onClick={(e) => {
          e.stopPropagation();
          if (isBackdropClickable) {
            onClose();
          }
        }}
      />

      {/* Modal */}
      <div
        className={`relative bg-base-100 p-6 max-h-[90vh] overflow-y-auto shadow-xl border border-base-300 ${
          isMiniApp
            ? "w-full rounded-t-xl"
            : isSuccess
            ? "rounded-xl w-full max-w-md mx-4"
            : "rounded-xl w-96 mx-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success State */}
        {isSuccess ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {isWithdrawal
                  ? "Withdrawal Successful! 💸"
                  : "Deposit Successful! 🎉"}
              </h2>
              <button
                onClick={onClose}
                className="btn btn-ghost btn-sm btn-circle cursor-pointer"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Success Details */}
            <div className="bg-base-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-base-content/70">
                  {isWithdrawal ? "Amount Withdrawn" : "Amount Deposited"}
                </span>
                <span className="font-mono font-bold">
                  {successAmount} {tokenSymbol}
                </span>
              </div>
              {!isWithdrawal && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-content/70">
                      Your Pool Share
                    </span>
                    <span className="font-mono font-bold">
                      {successPercentage}%
                    </span>
                  </div>
                </>
              )}
              {isWithdrawal && (
                <>
                  <div className="divider my-2"></div>
                  <div className="text-sm text-base-content/70">
                    <p>
                      ✅ Your staked {tokenSymbol} has been returned to your
                      wallet
                    </p>
                    <p>📊 You can still re-deposit to the crowdfund anytime</p>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {onShareToFarcaster && (
                <button
                  onClick={onShareToFarcaster}
                  className="btn btn-primary flex-1"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                  Share on Farcaster
                </button>
              )}
              <button onClick={onClose} className="btn btn-ghost flex-1">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {hasActiveContribution
                    ? "Manage Deposit"
                    : `Deposit to ${fundTitle}`}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="btn btn-ghost btn-sm btn-circle cursor-pointer"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Tab Navigation - only show if user has active contribution */}
            {hasActiveContribution && (
              <div className="tabs tabs-boxed mb-4">
                <button
                  className={`tab flex-1 ${
                    activeTab === "add"
                      ? "tab-active bg-primary text-primary-content hover:text-white"
                      : "hover:bg-primary/20"
                  }`}
                  onClick={() => setActiveTab("add")}
                >
                  Add More
                </button>
                <button
                  className={`tab flex-1 ${
                    activeTab === "withdraw"
                      ? "tab-active bg-warning text-warning-content"
                      : "hover:bg-warning/20"
                  }`}
                  onClick={() => setActiveTab("withdraw")}
                >
                  <span className="mr-2">➖</span>
                  Withdraw
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="alert alert-error mb-4">
                <span>{error}</span>
              </div>
            )}

            {/* Tab Content */}
            <div className="space-y-4">
              {!hasActiveContribution || activeTab === "add" ? (
                /* Add More Tab */
                <div className="space-y-4">
                  {/* Add More Amount Input */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Amount (st{tokenSymbol})
                    </label>

                    {/* Add More Slider - right above input */}
                    <div className="mb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            className="range range-sm range-primary w-full"
                            value={percentage}
                            onChange={(e) =>
                              onSliderChange(Number(e.target.value))
                            }
                            disabled={
                              isApproving || isDepositing || isConfirming
                            }
                          />
                          <div className="flex justify-between text-xs mt-1 text-base-content/60 px-2">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                          </div>
                        </div>
                        <div className="text-sm font-medium w-12 text-right mt-1">
                          {percentage.toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <input
                      type="number"
                      placeholder="0.0"
                      className="input input-bordered w-full"
                      value={amount}
                      onChange={(e) => onAmountChange(e.target.value)}
                      disabled={isApproving || isDepositing || isConfirming}
                    />
                    {userStakedTokenBalance && userStakedTokenBalance > 0n && (
                      <p className="text-xs text-base-content/60 mt-1">
                        Available: {formatStakeAmount(userStakedTokenBalance)}{" "}
                        st{tokenSymbol}
                      </p>
                    )}
                  </div>

                  {/* Add More Button */}
                  <button
                    onClick={onContribute}
                    className="btn btn-primary w-full"
                    disabled={
                      !amount ||
                      parseFloat(amount) <= 0 ||
                      isApproving ||
                      isDepositing ||
                      isConfirming ||
                      isPaused
                    }
                  >
                    {isApproving ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Approving...
                      </>
                    ) : isDepositing || isConfirming ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Depositing...
                      </>
                    ) : (
                      <>{hasActiveContribution ? "Add More" : "Deposit"}</>
                    )}
                  </button>
                </div>
              ) : (
                /* Withdraw Tab */
                <div className="space-y-4">
                  {/* Withdraw Amount Input */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Amount to Withdraw (st{tokenSymbol})
                    </label>

                    {/* Withdraw Slider - right above input */}
                    <div className="mb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            className="range range-warning w-full"
                            value={withdrawPercentage}
                            onChange={(e) =>
                              handleWithdrawSliderChange(Number(e.target.value))
                            }
                            disabled={isWithdrawing || isConfirming}
                          />
                          <div className="flex justify-between text-xs mt-1 text-base-content/60 px-2">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                          </div>
                        </div>
                        <div className="text-sm font-medium w-12 text-right mt-1">
                          {withdrawPercentage.toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <input
                      type="number"
                      placeholder="0.0"
                      className="input input-bordered w-full"
                      value={withdrawAmount}
                      onChange={(e) =>
                        handleWithdrawAmountChange(e.target.value)
                      }
                      disabled={isWithdrawing || isConfirming}
                    />
                    <p className="text-xs text-base-content/60 mt-1">
                      Current Deposit: {userContribution} st{tokenSymbol}
                    </p>
                  </div>

                  {/* Withdraw Button */}
                  <button
                    onClick={() => onWithdraw(false, withdrawAmount)}
                    className="btn btn-warning w-full"
                    disabled={
                      !withdrawAmount ||
                      parseFloat(withdrawAmount) <= 0 ||
                      isWithdrawing ||
                      isConfirming ||
                      isPaused
                    }
                  >
                    {isWithdrawing || isConfirming ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Withdrawing...
                      </>
                    ) : (
                      <>Withdraw</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Informational Text */}
            {!hasActiveContribution && (
              <div className="text-center pt-4 border-t border-base-300 mt-4">
                <p className="text-xs text-base-content/60">Withdraw anytime</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
