import { encodeAbiParameters } from "viem";
import type {
  AllocationConfig,
  StakingAllocationData,
  VaultAllocationData,
} from "@/src/app/types/tokenDeployment";

/**
 * Encode staking allocation data
 * Format: ["uint256", "int96"] => [lockDuration, streamDuration]
 */
export function encodeStakingAllocation(
  data: StakingAllocationData
): `0x${string}` {
  return encodeAbiParameters(
    [
      { name: "lockDuration", type: "uint256" },
      { name: "streamDuration", type: "int96" },
    ],
    [BigInt(data.lockDuration), BigInt(data.streamDuration)]
  );
}

/**
 * Encode vault allocation data
 * Format: ["uint256", "uint256"] => [lockupDuration, vestingDuration]
 */
export function encodeVaultAllocation(
  data: VaultAllocationData
): `0x${string}` {
  return encodeAbiParameters(
    [
      { name: "lockupDuration", type: "uint256" },
      { name: "vestingDuration", type: "uint256" },
    ],
    [BigInt(data.lockupDuration), BigInt(data.vestingDuration)]
  );
}

/**
 * Convert days to seconds
 */
export function daysToSeconds(days: number): number {
  return days * 24 * 60 * 60;
}

/**
 * Calculate LP allocation percentage
 */
export function calculateLPAllocation(
  stakingPercent: number,
  vaultPercent: number
): number {
  const total = stakingPercent + vaultPercent;
  if (total > 100) {
    throw new Error("Total allocations cannot exceed 100%");
  }
  return 100 - total;
}

/**
 * Validate allocation percentages
 */
export function validateAllocations(
  stakingPercent: number,
  vaultPercent: number
): { valid: boolean; error?: string } {
  if (stakingPercent < 0 || stakingPercent > 100) {
    return { valid: false, error: "Staking allocation must be 0-100%" };
  }
  if (vaultPercent < 0 || vaultPercent > 100) {
    return { valid: false, error: "Vault allocation must be 0-100%" };
  }
  if (stakingPercent + vaultPercent > 100) {
    return {
      valid: false,
      error: "Total allocations cannot exceed 100%",
    };
  }
  return { valid: true };
}

/**
 * Create staking allocation config
 */
export function createStakingAllocation(
  percentage: number,
  lockDays: number,
  flowDays: number,
  delegate?: string
): AllocationConfig {
  const lockDuration = daysToSeconds(lockDays);
  const streamDuration = daysToSeconds(flowDays);

  return {
    allocationType: 1, // Staking
    admin: (delegate || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    percentage: BigInt(percentage),
    data: encodeStakingAllocation({ lockDuration, streamDuration }),
  };
}

/**
 * Create vault allocation config
 */
export function createVaultAllocation(
  percentage: number,
  beneficiary: string,
  lockDays: number,
  vestingDays: number
): AllocationConfig {
  const lockupDuration = daysToSeconds(lockDays);
  const vestingDuration = daysToSeconds(vestingDays);

  return {
    allocationType: 0, // Vault
    admin: beneficiary as `0x${string}`,
    percentage: BigInt(percentage),
    data: encodeVaultAllocation({ lockupDuration, vestingDuration }),
  };
}
