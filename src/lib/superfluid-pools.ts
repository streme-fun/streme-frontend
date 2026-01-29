import { Address, parseUnits } from "viem";
import { publicClient } from "./viemClient";
import { GDA_V1_FORWARDER } from "./superfluid-contracts";
import { BestFriend } from "./neynar";
import { STREME_SUPER_TOKEN } from "./superfluid-constants";
// Import getBestFriendAddress from superfluid-streaming to avoid duplication
import { getBestFriendAddress } from "./superfluid-streaming";

// Re-export for backwards compatibility
export { STREME_SUPER_TOKEN, getBestFriendAddress };

// GDA V1 Forwarder ABI - key functions and events for pool management
export const GDA_V1_FORWARDER_ABI = [
  // Common event patterns for pool creation (we'll try multiple)
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "admin", type: "address" },
      { indexed: false, name: "pool", type: "address" }
    ],
    name: "PoolCreated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "pool", type: "address" },
      { indexed: true, name: "admin", type: "address" }
    ],
    name: "PoolConnectionUpdated",
    type: "event"
  },
  // Functions
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "admin", type: "address" },
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "transferabilityForUnitsOwner", type: "bool" },
          { name: "distributionFromAnyAddress", type: "bool" }
        ]
      }
    ],
    name: "createPool",
    outputs: [
      { name: "success", type: "bool" },
      { name: "pool", type: "address" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "memberAddress", type: "address" },
      { name: "newUnits", type: "uint128" },
      { name: "userData", type: "bytes" }
    ],
    name: "updateMemberUnits",
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "pool", type: "address" },
      { name: "requestedAmount", type: "uint256" },
      { name: "userData", type: "bytes" }
    ],
    name: "distribute",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "userData", type: "bytes" }
    ],
    name: "connectPool",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "member", type: "address" }
    ],
    name: "isMemberConnected",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "requestedAmount", type: "uint256" }
    ],
    name: "estimateDistributionActualAmount",
    outputs: [{ name: "actualAmount", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "pool", type: "address" },
      { name: "requestedFlowRate", type: "int96" },
      { name: "userData", type: "bytes" }
    ],
    name: "setFlowrateToPool",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "pool", type: "address" }
    ],
    name: "getFlowrateToPool",
    outputs: [{ name: "flowRate", type: "int96" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// Pool configuration for best friends distribution
export const BEST_FRIENDS_POOL_CONFIG = {
  transferabilityForUnitsOwner: false, // Friends can't transfer their units
  distributionFromAnyAddress: false,   // Only pool admin can distribute
};

// Standard units per friend (equal distribution)
export const UNITS_PER_FRIEND = 100n;

/**
 * Calculate weekly distribution amount based on staking rewards.
 * Uses BigInt arithmetic to avoid precision loss for large values.
 *
 * @param dailyFlowRate - Daily flow rate as a string (tokens per day)
 * @returns Weekly amount in wei as bigint
 */
export function calculateWeeklyAmount(dailyFlowRate: string): bigint {
  if (!dailyFlowRate || dailyFlowRate === "0") return BigInt(0);

  // Use parseUnits to convert to wei with proper precision
  // This avoids parseFloat precision loss
  const dailyAmountWei = parseUnits(dailyFlowRate, 18);

  // Multiply by 7 using BigInt arithmetic (no precision loss)
  return dailyAmountWei * 7n;
}

/**
 * Convert daily token amount to Superfluid flow rate (tokens per second)
 */
export function dailyAmountToFlowRate(dailyAmount: bigint): bigint {
  if (dailyAmount === BigInt(0)) return BigInt(0);
  
  // Flow rate = tokens per second in wei
  // 1 day = 86400 seconds
  const flowRate = dailyAmount / BigInt(86400);
  return flowRate;
}

/**
 * Convert flow rate to daily amount for display
 */
export function flowRateToDailyAmount(flowRate: bigint): bigint {
  if (flowRate === BigInt(0)) return BigInt(0);
  
  // Daily amount = flow rate * seconds per day
  const dailyAmount = flowRate * BigInt(86400);
  return dailyAmount;
}

/**
 * Check if a member is connected to a pool
 */
export async function isMemberConnected(poolAddress: Address, memberAddress: Address): Promise<boolean> {
  try {
    const isConnected = await publicClient.readContract({
      address: GDA_V1_FORWARDER,
      abi: GDA_V1_FORWARDER_ABI,
      functionName: "isMemberConnected",
      args: [poolAddress, memberAddress],
    });
    
    return isConnected as boolean;
  } catch (error) {
    console.error("Error checking member connection:", error);
    return false;
  }
}

/**
 * Estimate the actual distribution amount
 */
export async function estimateDistribution(
  from: Address,
  poolAddress: Address,
  requestedAmount: bigint
): Promise<bigint> {
  try {
    const actualAmount = await publicClient.readContract({
      address: GDA_V1_FORWARDER,
      abi: GDA_V1_FORWARDER_ABI,
      functionName: "estimateDistributionActualAmount",
      args: [STREME_SUPER_TOKEN, from, poolAddress, requestedAmount],
    });
    
    return actualAmount as bigint;
  } catch (error) {
    console.error("Error estimating distribution:", error);
    return requestedAmount; // Fallback to requested amount
  }
}

/**
 * Get current flow rate to a pool
 */
export async function getFlowRateToPool(
  sender: Address,
  poolAddress: Address
): Promise<bigint> {
  try {
    const flowRate = await publicClient.readContract({
      address: GDA_V1_FORWARDER,
      abi: GDA_V1_FORWARDER_ABI,
      functionName: "getFlowrateToPool",
      args: [STREME_SUPER_TOKEN, sender, poolAddress],
    });
    
    return BigInt((flowRate as bigint).toString());
  } catch (error) {
    console.error("Error getting flow rate to pool:", error);
    return BigInt(0);
  }
}

/**
 * Interface for pool information
 */
export interface PoolInfo {
  address: Address;
  admin: Address;
  members: Array<{
    friend: BestFriend;
    address: Address;
    units: bigint;
    isConnected: boolean;
  }>;
  totalMembers: number;
  createdAt: number;
  weeklyAmount: bigint;
  lastDistribution?: number;
}

/**
 * Interface for distribution history
 */
export interface DistributionRecord {
  txHash: string;
  amount: bigint;
  amountPerMember: bigint;
  memberCount: number;
  timestamp: number;
  blockNumber: number;
}

/**
 * Prepare pool creation transaction data
 */
export function prepareCreatePool(admin: Address) {
  return {
    address: GDA_V1_FORWARDER,
    abi: GDA_V1_FORWARDER_ABI,
    functionName: "createPool" as const,
    args: [STREME_SUPER_TOKEN, admin, BEST_FRIENDS_POOL_CONFIG] as const,
  };
}

/**
 * Prepare member update transaction data
 */
export function prepareUpdateMember(
  poolAddress: Address,
  memberAddress: Address,
  units: bigint = UNITS_PER_FRIEND
) {
  return {
    address: GDA_V1_FORWARDER,
    abi: GDA_V1_FORWARDER_ABI,
    functionName: "updateMemberUnits" as const,
    args: [poolAddress, memberAddress, units, "0x"] as const,
  };
}

/**
 * Prepare distribution transaction data (for one-time distributions)
 */
export function prepareDistribution(
  from: Address,
  poolAddress: Address,
  amount: bigint
) {
  return {
    address: GDA_V1_FORWARDER,
    abi: GDA_V1_FORWARDER_ABI,
    functionName: "distribute" as const,
    args: [STREME_SUPER_TOKEN, from, poolAddress, amount, "0x"] as const,
  };
}

/**
 * Prepare streaming flow rate transaction to pool (for continuous distributions)
 */
export function prepareStreamToPool(
  sender: Address,
  poolAddress: Address,
  flowRate: bigint
) {
  return {
    address: GDA_V1_FORWARDER,
    abi: GDA_V1_FORWARDER_ABI,
    functionName: "setFlowrateToPool" as const,
    args: [STREME_SUPER_TOKEN, sender, poolAddress, flowRate, "0x"] as const,
  };
}

/**
 * Prepare pool connection transaction data (for friends to connect)
 */
export function prepareConnectPool(poolAddress: Address) {
  return {
    address: GDA_V1_FORWARDER,
    abi: GDA_V1_FORWARDER_ABI,
    functionName: "connectPool" as const,
    args: [poolAddress, "0x"] as const,
  };
}