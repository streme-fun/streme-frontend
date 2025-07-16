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
  hash,
  onAmountChange,
  onSliderChange,
  onContribute,
  onWithdraw,
  isMiniApp = false,
}: ContributionModalProps) {
  const [activeTab, setActiveTab] = useState<'add' | 'withdraw'>('add');
  const [withdrawPercentage, setWithdrawPercentage] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Helper function to calculate withdraw amount from percentage of current contribution
  const calculateWithdrawAmountFromPercentage = (percent: number): string => {
    if (!hasActiveContribution) return "0";
    // Parse the current contribution amount (remove commas and convert to number)
    const currentAmount = parseFloat(userContribution.replace(/,/g, ''));
    const withdrawAmount = (currentAmount * percent) / 100;
    return withdrawAmount.toFixed(2);
  };

  // Helper function to calculate withdraw percentage from amount
  const calculateWithdrawPercentageFromAmount = (amount: string): number => {
    if (!hasActiveContribution || !amount) return 0;
    const currentAmount = parseFloat(userContribution.replace(/,/g, ''));
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
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);


  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 ${
        isMiniApp ? "flex items-end" : "flex items-center justify-center"
      }`}
    >
      {/* Subtle backdrop for click-to-close */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Modal */}
      <div
        className={`relative bg-base-100 p-6 max-h-[90vh] overflow-y-auto shadow-xl border border-base-300 ${
          isMiniApp ? "w-full rounded-t-xl" : "rounded-xl w-96 mx-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Manage Your Redirect</h2>
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

        {/* Tab Navigation */}
        <div className="tabs tabs-boxed mb-4">
          <button 
            className={`tab flex-1 ${activeTab === 'add' ? 'tab-active bg-success text-success-content' : 'hover:bg-success/20'}`}
            onClick={() => setActiveTab('add')}
          >
            <span className="mr-2">➕</span>
            Add More
          </button>
          {hasActiveContribution && (
            <button 
              className={`tab flex-1 ${activeTab === 'withdraw' ? 'tab-active bg-warning text-warning-content' : 'hover:bg-warning/20'}`}
              onClick={() => setActiveTab('withdraw')}
            >
              <span className="mr-2">➖</span>
              Withdraw
            </button>
          )}
        </div>

        {/* Info about redirecting - only show on Add tab for initial contributions */}
        {activeTab === 'add' && !hasActiveContribution && (
          <div className="bg-info/10 border border-info/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-info flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-info mb-1">You&apos;re redirecting, not giving away</p>
                <p className="text-base-content/70">
                  This redirects your staking rewards to fund the mission. Your staked tokens remain yours and you can withdraw them anytime.
                </p>
              </div>
            </div>
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
          {activeTab === 'add' ? (
            /* Add More Tab */
            <div className="space-y-4">
              {/* Add More Slider */}
              <div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    className="range range-success flex-1"
                    value={percentage}
                    onChange={(e) => onSliderChange(Number(e.target.value))}
                    disabled={isApproving || isDepositing || isConfirming}
                  />
                  <span className="text-sm font-medium w-8 text-right">{percentage.toFixed(0)}%</span>
                </div>
                <div className="flex">
                  <div className="flex-1 flex justify-between text-xs px-2 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <div className="w-8"></div>
                </div>
              </div>

              {/* Add More Amount Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Additional Amount (STREME)
                </label>
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
                    Available: {formatStakeAmount(userStakedTokenBalance)} STREME
                  </p>
                )}
              </div>

              {/* Add More Button */}
              <button
                onClick={onContribute}
                className="btn btn-success w-full"
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  isApproving ||
                  isDepositing ||
                  isConfirming ||
                  isPaused
                }
              >
                {isApproving || isDepositing || isConfirming ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="mr-2">➕</span>
                    {hasActiveContribution ? 'Add More to Redirect' : 'Start Redirecting'}
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Withdraw Tab */
            <div className="space-y-4">
              {/* Withdraw Slider */}
              <div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    className="range range-warning flex-1"
                    value={withdrawPercentage}
                    onChange={(e) => handleWithdrawSliderChange(Number(e.target.value))}
                    disabled={isWithdrawing || isConfirming}
                  />
                  <span className="text-sm font-medium w-8 text-right">{withdrawPercentage.toFixed(0)}%</span>
                </div>
                <div className="flex">
                  <div className="flex-1 flex justify-between text-xs px-2 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <div className="w-8"></div>
                </div>
              </div>

              {/* Withdraw Amount Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount to Withdraw (STREME)
                </label>
                <input
                  type="number"
                  placeholder="0.0"
                  className="input input-bordered w-full"
                  value={withdrawAmount}
                  onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                  disabled={isWithdrawing || isConfirming}
                />
                <p className="text-xs text-base-content/60 mt-1">
                  Currently redirecting: {userContribution} STREME
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
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="mr-2">➖</span>
                    Withdraw Amount
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Transaction Hash */}
        {hash && (
          <div className="text-center mt-4">
            <p className="text-sm text-base-content/70">
              Transaction:{" "}
              <span className="font-mono">
                {hash.slice(0, 10)}...{hash.slice(-8)}
              </span>
            </p>
          </div>
        )}

        {/* Informational Text */}
        {!hasActiveContribution && activeTab === 'add' && (
          <div className="text-center pt-4 border-t border-base-300 mt-4">
            <p className="text-xs text-base-content/60">
              Your staked tokens remain yours • Withdraw anytime • No lock-up
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
