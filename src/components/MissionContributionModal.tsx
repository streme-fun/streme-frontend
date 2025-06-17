"use client";

import { useState, useEffect } from "react";
import { Mission } from "@/src/app/types/mission";
import { useAccount } from "wagmi";
import { 
  useStremeStakingContract, 
  useStakingContractActions, 
  formatStakeAmount 
} from "@/src/hooks/useStremeStakingContract";

interface MissionContributionModalProps {
  mission: Mission;
  onClose: () => void;
  onContribution?: (amount: string, missionId: string) => void;
}

export const MissionContributionModal = ({ 
  mission, 
  onClose, 
  onContribution 
}: MissionContributionModalProps) => {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<'input' | 'approve' | 'deposit' | 'success'>('input');
  const [error, setError] = useState("");
  // const [shouldAutoDeposit, setShouldAutoDeposit] = useState(false);

  const {
    userStakedTokenBalance,
    userAllowance,
    userDepositBalance,
    isPaused,
    stakedStremeCoinAddress,
    contractAddress,
    refetchAllowance,
    refetchUserBalance
  } = useStremeStakingContract();

  const {
    approveTokens,
    depositTokens,
    isApproving: isApprovingFromHook,
    isDepositing,
    isConfirming,
    isConfirmed,
    error: contractError,
    hash
  } = useStakingContractActions();
  
  const [, setIsApproving] = useState(false);

  // Format balances for display
  const userStakedBalance = formatStakeAmount(userStakedTokenBalance);
  const userContractBalance = formatStakeAmount(userDepositBalance);
  // const allowance = formatStakeAmount(userAllowance);

  // Check if user needs to approve tokens
  // const needsApproval = (() => {
  //   if (!userAllowance || !amount) return true;
  //   try {
  //     return userAllowance < BigInt(parseFloat(amount) * 1e18);
  //   } catch {
  //     return true;
  //   }
  // })();

  useEffect(() => {
    const handleTransactionConfirmed = async () => {
      if (isConfirmed && step === 'approve') {
        // After approval is confirmed, move to deposit step
        setStep('deposit');
        await refetchAllowance();
        // Reset the confirmation state so we can track the deposit transaction
        setIsApproving(false);
        
        // Auto-trigger deposit after approval
        setTimeout(() => {
          handleDeposit();
        }, 1000); // Small delay to ensure allowance is updated
      }
      if (isConfirmed && step === 'deposit') {
        setStep('success');
        refetchUserBalance();
        onContribution?.(amount, mission.id);
      }
    };
    
    handleTransactionConfirmed();
  }, [isConfirmed, step]);

  useEffect(() => {
    if (contractError) {
      setError(contractError.message || "Transaction failed");
    }
  }, [contractError]);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setError("");
  };

  const handleMaxClick = () => {
    if (userStakedTokenBalance) {
      setAmount(userStakedBalance);
    }
  };

  const handleApprove = async () => {
    if (!amount) return;
    setError("");
    setStep('approve');
    
    try {
      await approveTokens(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
      setStep('input');
    }
  };

  const handleDeposit = async () => {
    if (!amount) return;
    setError("");
    setStep('deposit');
    
    try {
      await depositTokens(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
      setStep('input');
    }
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!userStakedTokenBalance) {
      setError("Unable to load your staked STREME balance. Please make sure you're connected to the correct network.");
      return;
    }
    
    let amountBigInt: bigint;
    try {
      amountBigInt = BigInt(parseFloat(amount) * 1e18);
    } catch {
      setError("Invalid amount format");
      return;
    }
    
    if (amountBigInt > userStakedTokenBalance) {
      setError(`Insufficient staked STREME balance. You have ${userStakedBalance} but trying to contribute ${amount}`);
      return;
    }

    if (isPaused) {
      setError("Contract is currently paused");
      return;
    }

    // Check current allowance
    const currentNeedsApproval = !userAllowance || userAllowance < amountBigInt;
    
    if (currentNeedsApproval) {
      await handleApprove();
    } else {
      await handleDeposit();
    }
  };

  const progressPercentage = (mission.currentAmount / mission.goal) * 100;

  // Helper functions to avoid TypeScript comparison issues
  const getStepClass = (currentStep: string, targetStep: string, completedSteps: string[]) => {
    if (currentStep === targetStep) return 'text-primary';
    if (completedSteps.includes(currentStep)) return 'text-success';
    return 'text-base-content/50';
  };

  const getStepBadgeClass = (currentStep: string, targetStep: string, completedSteps: string[]) => {
    if (currentStep === targetStep) return 'border-primary';
    if (completedSteps.includes(currentStep)) return 'border-success bg-success text-success-content';
    return 'border-base-content/50';
  };

  const getStepIcon = (currentStep: string, targetStep: string, completedSteps: string[], number: string) => {
    if (completedSteps.includes(currentStep)) return '✓';
    return number;
  };

  const completedSteps = step === 'success' ? ['approve', 'deposit'] : step === 'deposit' ? ['approve'] : [];

  if (!isConnected) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Connect Wallet</h3>
          <p className="mb-4">Please connect your wallet to contribute to this mission.</p>
          <div className="modal-action">
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="modal modal-open">
        <div className="modal-box text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="font-bold text-lg mb-4">Contribution Successful!</h3>
          <p className="mb-4">
            You&apos;ve successfully contributed <strong>{amount} staked STREME</strong> to 
            <strong> {mission.title}</strong>!
          </p>
          <div className="bg-base-200 rounded-lg p-4 mb-4 text-left">
            <h4 className="font-semibold text-sm mb-2">📝 What happens next?</h4>
            <ul className="text-sm text-base-content/70 space-y-1">
              <li>• Your funds are now helping Streme bid on the daily QR auction</li>
              <li>• You can track your contribution on the leaderboard</li>
              <li>• You can withdraw your $STREME tokens at any time</li>
              <li>• If we win, the QR code will point to Streme for 24 hours!</li>
            </ul>
          </div>
          {hash && (
            <p className="text-sm text-base-content/70 mb-4">
              Transaction: <span className="font-mono">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
            </p>
          )}
          <div className="modal-action justify-center space-x-2">
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => {
                onClose();
                // TODO: Navigate to contributions dashboard
                // window.location.href = '/dashboard/contributions';
              }}
            >
              View My Contributions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">
          Contribute to {mission.title}
        </h3>

        {/* Mission Info */}
        <div className="bg-base-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Mission Progress</span>
            <span className="text-sm text-base-content/70">
              {(mission.currentAmount / 1000000).toFixed(1)}M / {(mission.goal / 1000000).toFixed(1)}M STREME
            </span>
          </div>
          <div className="w-full bg-base-300 rounded-full h-3 mb-2">
            <div 
              className="h-3 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-sm text-base-content/70">{mission.description}</p>
        </div>

        {/* User Balances */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-sm text-base-content/70">Your Staked STREME</div>
            <div className="text-lg font-bold">{userStakedBalance}</div>
            {userStakedTokenBalance ? (
              <div className="text-xs text-base-content/50">
                Balance loaded ✓
              </div>
            ) : (
              <div className="text-xs text-warning">
                Balance not loaded ⚠️
              </div>
            )}
          </div>
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-sm text-base-content/70">Contributed to Missions</div>
            <div className="text-lg font-bold text-primary">{userContractBalance}</div>
          </div>
        </div>

        {/* Amount Input */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text">Amount to Contribute</span>
            <span className="label-text-alt">
              Available: {userStakedBalance} staked STREME
              {userStakedTokenBalance && (
                <span className="block text-xs text-base-content/50">
                  (Raw: {userStakedTokenBalance.toString()})
                </span>
              )}
            </span>
          </label>
          <div className="input-group">
            <input
              type="number"
              placeholder="0.0"
              className="input input-bordered flex-1"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={step !== 'input'}
            />
            <button 
              className="btn btn-outline"
              onClick={handleMaxClick}
              disabled={step !== 'input'}
            >
              MAX
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
            {error.includes('cancelled') && (
              <button 
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setError("");
                  setStep('input');
                }}
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Contract Status */}
        {isPaused && (
          <div className="alert alert-warning mb-4">
            <span>⚠️ Contract is currently paused</span>
          </div>
        )}
        
        {/* Debug Info */}
        <div className="collapse collapse-arrow bg-base-200 mb-4">
          <input type="checkbox" /> 
          <div className="collapse-title text-sm font-medium">
            Debug Info (Click to expand)
          </div>
          <div className="collapse-content text-xs space-y-2">
            <div>Staked Token Address: {stakedStremeCoinAddress || 'Not loaded'}</div>
            <div>User Balance (raw): {userStakedTokenBalance?.toString() || 'Not loaded'}</div>
            <div>User Balance (formatted): {userStakedBalance}</div>
            <div>User Allowance: {userAllowance?.toString() || 'Not loaded'}</div>
            <div>Amount to contribute (wei): {amount && !isNaN(parseFloat(amount)) ? BigInt(parseFloat(amount) * 1e18).toString() : 'N/A'}</div>
            <div>Contract Address: {contractAddress}</div>
            <div>Is Paused: {isPaused?.toString()}</div>
            <div>Current Step: {step}</div>
          </div>
        </div>

        {/* Transaction Steps */}
        {step !== 'input' && (
          <div className="bg-base-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold mb-3">Transaction Progress</h4>
            {step === 'approve' && (
              <div className="alert alert-info mb-3">
                <span>Please approve the spending of your staked STREME tokens...</span>
              </div>
            )}
            {step === 'deposit' && (
              <div className="alert alert-info mb-3">
                <span>Approval successful! Now contributing your tokens to the mission...</span>
              </div>
            )}
            <div className="flex items-center space-x-4">
              {/* Step 1: Approve */}
              <div className={`flex items-center space-x-2 ${getStepClass(step, 'approve', completedSteps)}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${getStepBadgeClass(step, 'approve', completedSteps)}`}>
                  {getStepIcon(step, 'approve', completedSteps, '1')}
                </div>
                <span>Approve Tokens</span>
                {step === 'approve' && (isApprovingFromHook || isConfirming) && (
                  <span className="loading loading-spinner loading-sm"></span>
                )}
              </div>

              <div className="flex-1 h-px bg-base-300"></div>

              {/* Step 2: Deposit */}
              <div className={`flex items-center space-x-2 ${getStepClass(step, 'deposit', completedSteps)}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${getStepBadgeClass(step, 'deposit', completedSteps)}`}>
                  {getStepIcon(step, 'deposit', completedSteps, '2')}
                </div>
                <span>Contribute</span>
                {step === 'deposit' && (isDepositing || isConfirming) && (
                  <span className="loading loading-spinner loading-sm"></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button 
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isApprovingFromHook || isDepositing || isConfirming}
          >
            Cancel
          </button>
          
          {step === 'input' && (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!amount || parseFloat(amount) <= 0 || isPaused || !userStakedTokenBalance || BigInt(parseFloat(amount) * 1e18) > userStakedTokenBalance}
            >
              {(() => {
                try {
                  const amountBigInt = amount && !isNaN(parseFloat(amount)) ? BigInt(parseFloat(amount) * 1e18) : 0n;
                  const currentNeedsApproval = !userAllowance || userAllowance < amountBigInt;
                  return currentNeedsApproval ? 'Approve & Contribute' : 'Contribute';
                } catch {
                  return 'Approve & Contribute';
                }
              })()}
            </button>
          )}
          
          {step === 'deposit' && (
            <button
              className="btn btn-primary"
              onClick={handleDeposit}
              disabled={isDepositing || isConfirming}
            >
              {isDepositing || isConfirming ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Contributing...
                </>
              ) : (
                'Contribute Now'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};