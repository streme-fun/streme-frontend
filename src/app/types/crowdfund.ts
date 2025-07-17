export interface Crowdfund {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  goal: number; // Target amount in STREME
  currentAmount: number; // Current amount accumulated
  startDate: string;
  endDate?: string;
  isActive: boolean;
  category: CrowdfundCategory;
  rewards?: CrowdfundReward[];
  createdBy: string; // Address of creator
  totalContributors: number;
}

export interface CrowdfundContribution {
  id: string;
  crowdfundId: string;
  contributorAddress: string;
  amount: number; // Amount of staked STREME dedicated
  timestamp: string;
  transactionHash?: string;
  farcasterUser?: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
}

export interface CrowdfundLeaderboardEntry {
  rank: number;
  contributorAddress: string;
  totalContribution: number;
  percentage: number; // Percentage of total contributions
  farcasterUser?: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
}

export interface CrowdfundReward {
  type: 'nft' | 'token' | 'badge' | 'access';
  name: string;
  description: string;
  requirement: number; // Minimum contribution to qualify
  imageUrl?: string;
}

export enum CrowdfundCategory {
  DEFI = 'defi',
  GAMING = 'gaming',
  SOCIAL = 'social',
  CHARITY = 'charity',
  DEVELOPMENT = 'development',
  COMMUNITY = 'community',
  OTHER = 'other'
}

export interface CrowdfundStats {
  totalCrowdfunds: number;
  activeCrowdfunds: number;
  totalValueLocked: number;
  totalContributors: number;
  completedCrowdfunds: number;
}

export interface UserCrowdfundData {
  userAddress: string;
  totalContributions: number;
  activeCrowdfunds: string[]; // Crowdfund IDs
  completedCrowdfunds: string[]; // Crowdfund IDs
  badges: string[]; // Badge IDs earned
  rank?: number; // Global contributor rank
}

// Contract interaction types
export interface CrowdfundContractData {
  contractAddress: string;
  stakingRewardsFunderAddress: string; // 0xceaCfbB5A17b6914051D12D8c91d3461382d503b
  stremeCoinAddress: string;
  stakedStremeCoinAddress: string;
}