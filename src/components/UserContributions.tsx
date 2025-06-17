"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { 
  useStremeStakingContract, 
  useStakingContractActions,
  formatStakeAmount 
} from "@/src/hooks/useStremeStakingContract";
import { useStremePrice } from "@/src/hooks/useStremePrice";

export const UserContributions = () => {
  const { isConnected } = useAccount();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  
  const {
    userDepositBalance,
    totalBalance,
    isPaused,
    refetchUserBalance
  } = useStremeStakingContract();
  
  const {
    withdrawTokens,
    withdrawAllTokens,
    isWithdrawing,
    isConfirming,
    // isConfirmed,
    error,
    hash
  } = useStakingContractActions();
  
  const { formatUsd } = useStremePrice();
  
  const userContribution = formatStakeAmount(userDepositBalance);
  const userPercentage = userDepositBalance && totalBalance && totalBalance > 0n
    ? ((Number(userDepositBalance) / Number(totalBalance)) * 100).toFixed(2)
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
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">My Contributions</h2>
          <p className="text-base-content/70">Connect your wallet to view your mission contributions.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title flex justify-between items-center">
            <span>My QR Auction Contributions</span>
            {userDepositBalance && userDepositBalance > 0n && (
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setShowWithdrawModal(true)}
                disabled={isPaused}
              >
                Manage
              </button>
            )}
          </h2>
          
          {userDepositBalance && userDepositBalance > 0n ? (
            <div className="space-y-4">
              <div className="stats shadow">
                <div className="stat">
                  <div className="stat-title">Your Contribution</div>
                  <div className="stat-value text-primary">{userContribution}</div>
                  <div className="stat-desc">{formatUsd(parseFloat(userContribution))}</div>
                </div>
                
                <div className="stat">
                  <div className="stat-title">Your Share</div>
                  <div className="stat-value text-secondary">{userPercentage}%</div>
                  <div className="stat-desc">of total contributions</div>
                </div>
              </div>
              
              <div className="bg-base-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">🎯 Mission Status</h4>
                <p className="text-sm text-base-content/70">
                  Your $STREME is actively funding bids for the daily QR auction at qrcoin.fun.
                  When we win, thousands will see Streme through the QR code!
                  <br /><br />
                  <strong className="text-primary">Remember: You can withdraw your funds anytime using the button above!</strong>
                </p>
              </div>
              
              <div className="text-sm text-base-content/60">
                💡 You can withdraw your contribution at any time
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🚀</div>
              <p className="text-base-content/70 mb-4">
                You haven&apos;t contributed to the QR auction mission yet.
              </p>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-primary mb-1">
                  💰 Flexible Contributions
                </p>
                <p className="text-xs text-base-content/70">
                  Your tokens remain yours • Withdraw anytime • No lock-up period
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Withdraw Contribution</h3>
            
            {error && (
              <div className="alert alert-error mb-4">
                <span>{error.message || "Withdrawal failed"}</span>
              </div>
            )}
            
            <div className="bg-base-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-base-content/70 mb-2">Available to withdraw</div>
              <div className="text-2xl font-bold">{userContribution} STREME</div>
              <div className="text-sm text-accent">{formatUsd(parseFloat(userContribution))}</div>
            </div>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Withdraw Amount</span>
              </label>
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
                  className="btn btn-outline"
                  onClick={() => setWithdrawAmount(userContribution)}
                  disabled={withdrawing || isWithdrawing || isConfirming}
                >
                  MAX
                </button>
              </div>
            </div>
            
            {isPaused && (
              <div className="alert alert-warning mb-4">
                <span>⚠️ Contract is currently paused</span>
              </div>
            )}
            
            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount("");
                }}
                disabled={withdrawing || isWithdrawing || isConfirming}
              >
                Cancel
              </button>
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
                {isWithdrawing || isConfirming ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Withdrawing...
                  </>
                ) : (
                  'Withdraw'
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleWithdraw(true)}
                disabled={withdrawing || isWithdrawing || isConfirming || isPaused}
              >
                {isWithdrawing || isConfirming ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Withdrawing All...
                  </>
                ) : (
                  'Withdraw All'
                )}
              </button>
            </div>
            
            {hash && (
              <div className="text-center mt-4">
                <p className="text-sm text-base-content/70">
                  Transaction: <span className="font-mono">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};