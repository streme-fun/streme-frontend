// V2 Token Deployment Types

export interface AllocationConfig {
  allocationType: 0 | 1; // 0 = Vault, 1 = Staking
  admin: `0x${string}`;
  percentage: bigint;
  data: `0x${string}`; // Encoded allocation-specific data
}

export interface StakingAllocationData {
  lockDuration: number; // in seconds
  streamDuration: number; // in seconds (int96 when encoded)
}

export interface VaultAllocationData {
  lockupDuration: number; // in seconds
  vestingDuration: number; // in seconds
}

export interface V2FormData {
  // Basic token info
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;

  // V2 Staking configuration
  stakingAllocation: number; // percentage (0-100)
  stakingLockDays: number;
  stakingFlowDays: number;
  stakingDelegate?: string; // Optional delegate address

  // V2 Vault configuration (optional)
  enableVault: boolean;
  vaultAllocation: number; // percentage (0-100)
  vaultBeneficiary: string;
  vaultLockDays: number;
  vaultVestingDays: number;
}

export type TokenVersion = "v1" | "v2";
