export interface Mission {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  goal: number; // Target amount in STREME
  currentAmount: number; // Current amount accumulated
  startDate: string;
  endDate?: string;
  isActive: boolean;
  category: MissionCategory;
  rewards?: MissionReward[];
  createdBy: string; // Address of creator
  totalContributors: number;
}

export interface MissionContribution {
  id: string;
  missionId: string;
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

export interface MissionLeaderboardEntry {
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

export interface MissionReward {
  type: 'nft' | 'token' | 'badge' | 'access';
  name: string;
  description: string;
  requirement: number; // Minimum contribution to qualify
  imageUrl?: string;
}

export enum MissionCategory {
  DEFI = 'defi',
  GAMING = 'gaming',
  SOCIAL = 'social',
  CHARITY = 'charity',
  DEVELOPMENT = 'development',
  COMMUNITY = 'community',
  OTHER = 'other'
}

export interface MissionStats {
  totalMissions: number;
  activeMissions: number;
  totalValueLocked: number;
  totalContributors: number;
  completedMissions: number;
}

export interface UserMissionData {
  userAddress: string;
  totalContributions: number;
  activeMissions: string[]; // Mission IDs
  completedMissions: string[]; // Mission IDs
  badges: string[]; // Badge IDs earned
  rank?: number; // Global contributor rank
}

// Contract interaction types
export interface MissionContractData {
  contractAddress: string;
  stakingRewardsFunderAddress: string; // 0xceaCfbB5A17b6914051D12D8c91d3461382d503b
  stremeCoinAddress: string;
  stakedStremeCoinAddress: string;
}