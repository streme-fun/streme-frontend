import { Address, formatUnits, parseUnits } from "viem";
import { publicClient } from "./viemClient";
import { CFA_V1_FORWARDER } from "./superfluid-contracts";
import { BestFriend } from "./neynar";
import { STREME_SUPER_TOKEN, SECONDS_PER_DAY } from "./superfluid-constants";

// Re-export for backwards compatibility
export { STREME_SUPER_TOKEN };

// CFAv1Forwarder ABI - functions we need for streaming
export const CFA_V1_FORWARDER_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "receiver", type: "address" },
      { name: "flowrate", type: "int96" }
    ],
    name: "setFlowrate",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "account", type: "address" }
    ],
    name: "getAccountFlowrate",
    outputs: [{ name: "flowrate", type: "int96" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "flowrate", type: "int96" }
    ],
    name: "getBufferAmountByFlowrate",
    outputs: [{ name: "bufferAmount", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

/**
 * Convert tokens per day to flow rate per second (Superfluid format)
 * Uses BigInt arithmetic to avoid precision loss for large values.
 *
 * @param tokensPerDay - Number of tokens per day (as a decimal string for precision)
 * @returns Flow rate in wei per second as bigint
 */
export function tokensPerDayToFlowRate(tokensPerDay: number | string): bigint {
  // Convert to string to use parseUnits for precision
  const tokensPerDayStr = typeof tokensPerDay === 'number'
    ? tokensPerDay.toString()
    : tokensPerDay;

  // Parse as wei (18 decimals) - this gives us tokens per day in wei
  const tokensPerDayWei = parseUnits(tokensPerDayStr, 18);

  // Divide by seconds per day to get flow rate per second
  return tokensPerDayWei / SECONDS_PER_DAY;
}

/**
 * Convert flow rate per second to tokens per day for display.
 * Returns a string representation to preserve precision.
 * For display purposes, you can safely convert small values to number.
 *
 * @param flowRate - Flow rate in wei per second as bigint
 * @returns Tokens per day as a string (use parseFloat for display if needed)
 */
export function flowRateToTokensPerDay(flowRate: bigint): number {
  // Multiply by seconds per day first (in BigInt to avoid precision loss)
  const tokensPerDayWei = flowRate * SECONDS_PER_DAY;

  // Format to human-readable tokens (18 decimals)
  // For typical display values, this conversion to number is safe
  const formatted = formatUnits(tokensPerDayWei, 18);
  return parseFloat(formatted);
}

/**
 * Convert flow rate per second to tokens per day as a string (full precision).
 * Use this when you need to preserve precision for large values.
 */
export function flowRateToTokensPerDayString(flowRate: bigint): string {
  const tokensPerDayWei = flowRate * SECONDS_PER_DAY;
  return formatUnits(tokensPerDayWei, 18);
}

/**
 * Get the current outgoing flow rate for an account.
 * Returns the absolute value of the flow rate (outgoing flows are negative).
 */
export async function getAccountFlowRate(account: Address): Promise<bigint> {
  try {
    const flowRate = await publicClient.readContract({
      address: CFA_V1_FORWARDER,
      abi: CFA_V1_FORWARDER_ABI,
      functionName: "getAccountFlowrate",
      args: [STREME_SUPER_TOKEN, account],
    });
    // Use BigInt comparison to get absolute value without Number conversion
    const flowRateBigInt = flowRate as bigint;
    return flowRateBigInt < 0n ? -flowRateBigInt : flowRateBigInt;
  } catch (error) {
    console.error("Error getting account flow rate:", error);
    return BigInt(0);
  }
}

/**
 * Get required buffer amount for a given flow rate
 */
export async function getRequiredBuffer(flowRate: bigint): Promise<bigint> {
  try {
    const buffer = await publicClient.readContract({
      address: CFA_V1_FORWARDER,
      abi: CFA_V1_FORWARDER_ABI,
      functionName: "getBufferAmountByFlowrate",
      args: [STREME_SUPER_TOKEN, flowRate],
    });
    return buffer as bigint;
  } catch (error) {
    console.error("Error getting required buffer:", error);
    throw error;
  }
}

/**
 * Get the Ethereum address for a best friend (custody or verified address)
 */
export function getBestFriendAddress(friend: BestFriend): Address | null {
  // Prefer custody address, fallback to first verified eth address
  if (friend.custody_address) {
    return friend.custody_address as Address;
  }
  
  if (friend.verified_addresses.eth_addresses.length > 0) {
    return friend.verified_addresses.eth_addresses[0] as Address;
  }
  
  return null;
}

/**
 * Calculate equal flow rates for best friends streaming
 */
export function calculateEqualFlowRates(
  availableFlowRate: bigint,
  selectedFriends: BestFriend[]
): { flowRatePerFriend: bigint; totalFlowRate: bigint } {
  if (selectedFriends.length === 0) {
    return { flowRatePerFriend: BigInt(0), totalFlowRate: BigInt(0) };
  }
  
  // Use 80% of available flow rate for safety buffer
  const usableFlowRate = (availableFlowRate * BigInt(80)) / BigInt(100);
  const flowRatePerFriend = usableFlowRate / BigInt(selectedFriends.length);
  const totalFlowRate = flowRatePerFriend * BigInt(selectedFriends.length);
  
  return { flowRatePerFriend, totalFlowRate };
}

/**
 * Prepare multicall transaction data for streaming to best friends
 */
export function prepareStreamingMulticall(
  selectedFriends: BestFriend[],
  flowRatePerFriend: bigint
): { 
  contracts: Array<{
    address: Address;
    abi: typeof CFA_V1_FORWARDER_ABI;
    functionName: "setFlowrate";
    args: [Address, Address, bigint];
  }>;
  recipients: Array<{ friend: BestFriend; address: Address }>;
} {
  const recipients: Array<{ friend: BestFriend; address: Address }> = [];
  
  // Filter friends with valid addresses and prepare contract calls
  const contracts = selectedFriends
    .map(friend => {
      const address = getBestFriendAddress(friend);
      if (!address) return null;
      
      recipients.push({ friend, address });
      
      return {
        address: CFA_V1_FORWARDER,
        abi: CFA_V1_FORWARDER_ABI,
        functionName: "setFlowrate" as const,
        args: [STREME_SUPER_TOKEN, address, flowRatePerFriend] as [Address, Address, bigint],
      };
    })
    .filter(Boolean) as Array<{
      address: Address;
      abi: typeof CFA_V1_FORWARDER_ABI;
      functionName: "setFlowrate";
      args: [Address, Address, bigint];
    }>;

  return { contracts, recipients };
}

/**
 * Estimate gas for streaming multicall
 */
export async function estimateStreamingGas(
  account: Address,
  contracts: Array<{
    address: Address;
    abi: typeof CFA_V1_FORWARDER_ABI;
    functionName: "setFlowrate";
    args: [Address, Address, bigint];
  }>
): Promise<bigint> {
  try {
    // For now, return a reasonable estimate based on number of contracts
    // In a real implementation, you'd estimate gas for individual setFlowrate calls
    // and sum them up, or estimate gas for a proper multicall contract
    const gasPerStream = BigInt(150000); // Estimated gas per setFlowrate call
    const totalGas = gasPerStream * BigInt(contracts.length);
    
    return totalGas;
  } catch (error) {
    console.error("Error estimating gas:", error);
    // Return a reasonable default gas estimate
    return BigInt(contracts.length * 100000); // ~100k gas per stream
  }
}

/**
 * Interface for streaming summary
 */
export interface StreamingSummary {
  selectedFriends: BestFriend[];
  flowRatePerFriend: bigint;
  totalFlowRate: bigint;
  tokensPerDayPerFriend: number;
  totalTokensPerDay: number;
  recipients: Array<{ friend: BestFriend; address: Address }>;
  estimatedGas?: bigint;
}

/**
 * Create a complete streaming summary
 */
export async function createStreamingSummary(
  availableFlowRate: bigint,
  selectedFriends: BestFriend[],
  userAddress?: Address
): Promise<StreamingSummary> {
  const { flowRatePerFriend, totalFlowRate } = calculateEqualFlowRates(
    availableFlowRate,
    selectedFriends
  );
  
  const { recipients } = prepareStreamingMulticall(selectedFriends, flowRatePerFriend);
  
  const tokensPerDayPerFriend = flowRateToTokensPerDay(flowRatePerFriend);
  const totalTokensPerDay = flowRateToTokensPerDay(totalFlowRate);
  
  let estimatedGas: bigint | undefined;
  if (userAddress && recipients.length > 0) {
    const { contracts } = prepareStreamingMulticall(selectedFriends, flowRatePerFriend);
    try {
      estimatedGas = await estimateStreamingGas(userAddress, contracts);
    } catch (error) {
      console.warn("Could not estimate gas:", error);
    }
  }
  
  return {
    selectedFriends,
    flowRatePerFriend,
    totalFlowRate, 
    tokensPerDayPerFriend,
    totalTokensPerDay,
    recipients,
    estimatedGas,
  };
}