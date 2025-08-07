"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import {
  useStremeStakingContract,
  useStakingContractActions,
  formatStakeAmount,
} from "@/src/hooks/useStremeStakingContract";
import { getPrices } from "@/src/lib/priceUtils";

export const UserContributions = () => {
  const { isConnected } = useAccount();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [stremePrice, setStremePrice] = useState<number | null>(null);

  const { userDepositBalance, totalBalance, isPaused, refetchUserBalance } =
    useStremeStakingContract();

  const {
    withdrawTokens,
    withdrawAllTokens,
    isWithdrawing,
    isConfirming,
    error,
    hash,
  } = useStakingContractActions();

  // STREME token contract address
  const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";

  // Fetch STREME price using the same method as crowdfund page
  useEffect(() => {
    const fetchStremePrice = async () => {
      try {
        const prices = await getPrices([STREME_TOKEN_ADDRESS]);
        if (prices && prices[STREME_TOKEN_ADDRESS.toLowerCase()]) {
          setStremePrice(prices[STREME_TOKEN_ADDRESS.toLowerCase()]);
        } else {
          // Fallback: try to get price from the token's single API endpoint
          const response = await fetch(
            `/api/tokens/single?address=${STREME_TOKEN_ADDRESS}`
          );
          if (response.ok) {
            const data = await response.json();
            const tokenPrice = data.data?.price || data.data?.marketData?.price;
            if (tokenPrice && !isNaN(tokenPrice)) {
              setStremePrice(tokenPrice);
            }
          }
        }
      } catch (error) {
        console.error(
          "Error fetching STREME price in UserContributions:",
          error
        );
      }
    };

    fetchStremePrice();
    // Update price every 2 minutes
    const interval = setInterval(fetchStremePrice, 120000);
    return () => clearInterval(interval);
  }, [STREME_TOKEN_ADDRESS]);

  // Format USD function using raw bigint amount
  const formatUsd = (stremeAmountBigint: bigint | undefined): string => {
    if (!stremePrice || !stremeAmountBigint) return "$0.00";
    // Convert from wei to actual token amount (18 decimals)
    const stremeAmount = Number(formatUnits(stremeAmountBigint, 18));
    const usdValue = stremeAmount * stremePrice;

    return `$${usdValue.toFixed(4)}`;
  };

  const userContribution = formatStakeAmount(userDepositBalance);
  const userPercentage =
    userDepositBalance && totalBalance && totalBalance > 0n
      ? ((Number(userDepositBalance) / Number(totalBalance)) * 100).toFixed(1)
      : "0";

  const handleWithdraw = async (withdrawAll: boolean = false) => {
    try {
      setWithdrawing(true);
      if (withdrawAll) {
        await withdrawAllTokens();
      } else {
        await withdrawTokens(withdrawAmount);
      }
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      refetchUserBalance();
    } catch (err) {
      console.error("Withdrawal error:", err);
    } finally {
      setWithdrawing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="alert">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="stroke-info shrink-0 w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <span>Connect your wallet to view and manage your deposit</span>
      </div>
    );
  }

  return (
    <>
      {userDepositBalance && userDepositBalance > 0n ? (
        <div className="alert alert-info flex flex-col">
          <div className="flex flex-row">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div className="flex-1">
              <h3 className="font-bold">Your Mission Contribution</h3>
              <p className="text-sm">
                You&apos;re contributing{" "}
                <span className="font-bold">{userContribution} STREME</span> (
                {formatUsd(userDepositBalance)}) to the Streme Growth Fund -
                that&apos;s {userPercentage}% of the total pool!
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowWithdrawModal(true)}
            disabled={isPaused}
          >
            Withdraw Funds
          </button>
        </div>
      ) : (
        <div className="text-center py-6 px-4 bg-base-200 rounded-lg">
          <p className="text-base-content/70 mb-2">
            Join the mission to help Streme grow!
          </p>
          <p className="text-sm text-base-content/60">
            Your tokens remain yours • Withdraw anytime • No lock-up
          </p>
        </div>
      )}

      {/* Simplified Withdraw Modal */}
      {showWithdrawModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Withdraw Your Funds</h3>

            {error && (
              <div className="alert alert-error mb-4">
                <span>{error.message || "Withdrawal failed"}</span>
              </div>
            )}

            <div className="bg-primary/10 rounded-lg p-6 mb-6 text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {userContribution} STREME
              </div>
              <div className="text-lg">{formatUsd(userDepositBalance)}</div>
              <div className="text-sm text-base-content/70 mt-2">
                Available to withdraw
              </div>
            </div>

            <div className="space-y-3">
              <button
                className="btn btn-primary btn-block btn-lg"
                onClick={() => handleWithdraw(true)}
                disabled={
                  withdrawing || isWithdrawing || isConfirming || isPaused
                }
              >
                {isWithdrawing || isConfirming ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Processing...
                  </>
                ) : (
                  "Withdraw All Funds"
                )}
              </button>

              <div className="divider text-sm">OR WITHDRAW CUSTOM AMOUNT</div>

              <div className="form-control">
                <div className="input-group">
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered flex-1"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    disabled={withdrawing || isWithdrawing || isConfirming}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleWithdraw(false)}
                    disabled={
                      !withdrawAmount ||
                      parseFloat(withdrawAmount) <= 0 ||
                      withdrawing ||
                      isWithdrawing ||
                      isConfirming ||
                      isPaused
                    }
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              <button
                className="btn btn-ghost btn-block"
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount("");
                }}
                disabled={withdrawing || isWithdrawing || isConfirming}
              >
                Cancel
              </button>
            </div>

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
          </div>
        </div>
      )}
    </>
  );
};
