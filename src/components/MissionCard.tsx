"use client";

import { useState } from "react";
import { Mission } from "@/src/app/types/mission";
import { usePrivy } from "@privy-io/react-auth";
import { MissionContributionModal } from "@/src/components/MissionContributionModal";
import { useStremePrice } from "@/src/hooks/useStremePrice";

interface MissionCardProps {
  mission: Mission;
  onSelect?: (mission: Mission) => void;
}

export const MissionCard = ({ mission }: MissionCardProps) => {
  const { authenticated } = usePrivy();
  const [showContributeModal, setShowContributeModal] = useState(false);
  const { price } = useStremePrice();
  
  // Calculate USD value from STREME amount
  const currentUsdValue = price ? mission.currentAmount * price : 0;
  const progressPercentage = (currentUsdValue / mission.goal) * 100;
  const isCompleted = currentUsdValue >= mission.goal;
  const remainingUsd = Math.max(0, mission.goal - currentUsdValue);

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  };

  return (
    <div className="card bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20 shadow-xl">
      <div className="card-body p-4 sm:p-6 lg:p-8">
        {/* Header with QR Focus */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h2 className="card-title text-xl sm:text-2xl font-bold mb-2">
                {mission.title}
              </h2>
              <p className="text-sm sm:text-base text-base-content/70">
                {mission.description}
              </p>
            </div>
            <div className="flex-shrink-0">
              <a 
                href="https://qrcoin.fun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-sm btn-ghost w-full sm:w-auto"
              >
                View Auction →
              </a>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-base-100 rounded-lg p-4 sm:p-6 mb-6">
          {/* Stats - Stack on mobile, grid on larger screens */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold text-primary">${currentUsdValue.toFixed(0)}</div>
              <div className="text-xs sm:text-sm text-base-content/70">Raised</div>
            </div>
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold">{progressPercentage.toFixed(0)}%</div>
              <div className="text-xs sm:text-sm text-base-content/70">Complete</div>
            </div>
            {/* Hide contributors on mobile since it's 0, show on larger screens */}
            <div className="text-center hidden sm:block">
              <div className="text-lg sm:text-2xl font-bold text-secondary">{mission.totalContributors}</div>
              <div className="text-xs sm:text-sm text-base-content/70">Contributors</div>
            </div>
          </div>
          
          <div className="w-full bg-base-300 rounded-full h-3 sm:h-4 mb-3">
            <div 
              className="h-3 sm:h-4 rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm">
            <span>${remainingUsd.toFixed(0)} to goal</span>
            <span className="font-medium">{formatAmount(mission.currentAmount)} STREME staked</span>
          </div>
        </div>

        {/* Quick Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-base-100 rounded-lg p-3 text-center sm:text-center">
            <div className="text-lg sm:text-xl mb-1">🎯</div>
            <div className="text-sm font-semibold">Daily Bids</div>
            <div className="text-xs text-base-content/70">Win QR control</div>
          </div>
          <div className="bg-base-100 rounded-lg p-3 text-center sm:text-center">
            <div className="text-lg sm:text-xl mb-1">📢</div>
            <div className="text-sm font-semibold">Massive Reach</div>
            <div className="text-xs text-base-content/70">1000s of views</div>
          </div>
          <div className="bg-base-100 rounded-lg p-3 text-center sm:text-center">
            <div className="text-lg sm:text-xl mb-1">💰</div>
            <div className="text-sm font-semibold">Withdrawable</div>
            <div className="text-xs text-base-content/70">Anytime</div>
          </div>
        </div>

        {/* Action Button */}
        <div className="card-actions">
          {authenticated ? (
            <button 
              onClick={() => setShowContributeModal(true)}
              className="btn btn-primary btn-lg w-full"
              disabled={isCompleted}
            >
              {isCompleted ? '✅ Goal Reached!' : 'Contribute to Mission'}
            </button>
          ) : (
            <button className="btn btn-outline btn-lg w-full" disabled>
              Connect Wallet to Contribute
            </button>
          )}
        </div>
      </div>
      
      {/* Contribution Modal */}
      {showContributeModal && (
        <MissionContributionModal
          mission={mission}
          onClose={() => setShowContributeModal(false)}
          onContribution={(amount, missionId) => {
            console.log(`Contributed ${amount} STREME to mission ${missionId}`);
            setShowContributeModal(false);
          }}
        />
      )}
    </div>
  );
};