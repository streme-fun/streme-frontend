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
  const [showDetails, setShowDetails] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const { price } = useStremePrice();
  
  // Calculate USD value from STREME amount
  const currentUsdValue = price ? mission.currentAmount * price : 0;
  const progressPercentage = (currentUsdValue / mission.goal) * 100;
  const isCompleted = currentUsdValue >= mission.goal;
  const daysLeft = mission.endDate 
    ? Math.max(0, Math.ceil((new Date(mission.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const getCategoryColor = (category: string) => {
    const colors = {
      defi: 'badge-primary',
      gaming: 'badge-secondary', 
      social: 'badge-accent',
      charity: 'badge-success',
      development: 'badge-info',
      community: 'badge-warning',
      other: 'badge-neutral'
    };
    return colors[category as keyof typeof colors] || 'badge-neutral';
  };

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
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 border border-base-300">
      {/* Mission Image */}
      <figure className="relative h-48 overflow-hidden">
        <img 
          src={mission.imageUrl || "/api/placeholder/400/200"} 
          alt={mission.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
        <div className="absolute top-4 left-4">
          <div className={`badge ${getCategoryColor(mission.category)} badge-lg`}>
            {mission.category.toUpperCase()}
          </div>
        </div>
        {isCompleted && (
          <div className="absolute top-4 right-4">
            <div className="badge badge-success badge-lg">
              ✅ COMPLETED
            </div>
          </div>
        )}
      </figure>

      <div className="card-body p-6">
        {/* Title and Description */}
        <h2 className="card-title text-lg font-bold mb-2">
          {mission.title}
        </h2>
        <p className="text-base-content/70 text-sm mb-4 line-clamp-2">
          {mission.description}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-base-content/70">
              ${currentUsdValue.toFixed(0)} / ${mission.goal} USD
            </span>
          </div>
          <div className="w-full bg-base-300 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${
                isCompleted ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-base-content/50">
              {progressPercentage.toFixed(1)}% complete
            </span>
            <span className="text-xs text-base-content/50">
              {mission.totalContributors} contributors • {mission.currentAmount.toFixed(0)} $STREME
            </span>
          </div>
        </div>

        {/* Time and Rewards Info */}
        <div className="flex justify-between items-center mb-4">
          {daysLeft !== null && (
            <div className="text-sm">
              {daysLeft > 0 ? (
                <span className="text-warning">⏱️ {daysLeft} days left</span>
              ) : (
                <span className="text-success">🎯 Ongoing</span>
              )}
            </div>
          )}
          {/* Rewards display removed - not showing reward count */}
        </div>

        {/* Actions */}
        <div className="card-actions justify-between items-center">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="btn btn-ghost btn-sm"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          
          {authenticated && mission.isActive && !isCompleted && (
            <button 
              onClick={() => setShowContributeModal(true)}
              className="btn btn-primary btn-sm"
            >
              💎 Contribute
            </button>
          )}
        </div>

        {/* Expandable Details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-base-300 space-y-3">
            <div>
              <h4 className="font-semibold text-sm mb-1">Mission Details</h4>
              <p className="text-xs text-base-content/70">{mission.description}</p>
            </div>
            
            {mission.rewards && mission.rewards.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Rewards</h4>
                <div className="space-y-1">
                  {mission.rewards.map((reward, index) => (
                    <div key={index} className="text-xs bg-base-200 rounded p-2">
                      <div className="font-medium">{reward.name}</div>
                      <div className="text-base-content/60">{reward.description}</div>
                      <div className="text-primary">Min: {formatAmount(reward.requirement)} STREME</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-sm mb-1">Timeline</h4>
              <div className="text-xs text-base-content/70">
                <div>Started: {new Date(mission.startDate).toLocaleDateString()}</div>
                {mission.endDate && (
                  <div>Ends: {new Date(mission.endDate).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          </div>
        )}
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