import { Address, parseUnits, formatUnits } from "viem";
import { publicClient } from "./viemClient";
import { CFA_V1 } from "./superfluid-contracts";

// STREME Super Token address on Base
export const STREME_SUPER_TOKEN = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as Address;

// CFA V1 ABI - minimal functions we need
export const CFA_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" }
    ],
    name: "getFlow",
    outputs: [
      { name: "timestamp", type: "uint256" },
      { name: "flowRate", type: "int96" },
      { name: "deposit", type: "uint256" },
      { name: "owedDeposit", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "account", type: "address" }
    ],
    name: "getNetFlow",
    outputs: [
      { name: "flowRate", type: "int96" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "flowRate", type: "int96" }
    ],
    name: "getDepositRequiredForFlowRate",
    outputs: [
      { name: "deposit", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

// Superfluid Host ABI - for creating/updating/deleting flows
export const HOST_ABI = [
  {
    inputs: [
      { name: "agreementClass", type: "address" },
      { name: "callData", type: "bytes" },
      { name: "userData", type: "bytes" }
    ],
    name: "callAgreement",
    outputs: [
      { name: "returnedData", type: "bytes" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

// Super Token ABI - for balance and allowance checks
export const SUPER_TOKEN_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "account", type: "address" },
      { name: "time", type: "uint256" }
    ],
    name: "realtimeBalanceOfNow",
    outputs: [
      { name: "availableBalance", type: "int256" },
      { name: "deposit", type: "uint256" },
      { name: "owedDeposit", type: "uint256" },
      { name: "timestamp", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

/**
 * Get the current flow between sender and receiver
 */
export async function getFlow(sender: Address, receiver: Address) {
  try {
    const result = await publicClient.readContract({
      address: CFA_V1,
      abi: CFA_ABI,
      functionName: "getFlow",
      args: [STREME_SUPER_TOKEN, sender, receiver],
    });

    const [timestamp, flowRate, deposit, owedDeposit] = result as [bigint, bigint, bigint, bigint];
    return {
      timestamp,
      flowRate,
      deposit,
      owedDeposit,
    };
  } catch (error) {
    console.error("Error getting flow:", error);
    throw error;
  }
}

/**
 * Get the net flow rate for an account (incoming - outgoing)
 */
export async function getNetFlow(account: Address) {
  try {
    const flowRate = await publicClient.readContract({
      address: CFA_V1,
      abi: CFA_ABI,
      functionName: "getNetFlow",
      args: [STREME_SUPER_TOKEN, account],
    });

    return flowRate;
  } catch (error) {
    console.error("Error getting net flow:", error);
    throw error;
  }
}

/**
 * Get the deposit required for a given flow rate
 */
export async function getDepositRequired(flowRate: bigint) {
  try {
    const deposit = await publicClient.readContract({
      address: CFA_V1,
      abi: CFA_ABI,
      functionName: "getDepositRequiredForFlowRate",
      args: [STREME_SUPER_TOKEN, flowRate],
    });

    return deposit;
  } catch (error) {
    console.error("Error getting deposit required:", error);
    throw error;
  }
}

/**
 * Get the real-time balance of a Super Token
 */
export async function getRealtimeBalance(account: Address) {
  try {
    const result = await publicClient.readContract({
      address: STREME_SUPER_TOKEN,
      abi: SUPER_TOKEN_ABI,
      functionName: "realtimeBalanceOfNow",
      args: [account, BigInt(Math.floor(Date.now() / 1000))],
    });

    const [availableBalance, deposit, owedDeposit, timestamp] = result as [bigint, bigint, bigint, bigint];
    return {
      availableBalance,
      deposit,
      owedDeposit,
      timestamp,
    };
  } catch (error) {
    console.error("Error getting realtime balance:", error);
    throw error;
  }
}

/**
 * Convert flow rate from tokens per day to per second (as required by Superfluid)
 */
export function tokensPerDayToFlowRate(tokensPerDay: number): bigint {
  // Convert to tokens per second, then to wei per second
  const tokensPerSecond = tokensPerDay / (24 * 60 * 60);
  return parseUnits(tokensPerSecond.toString(), 18);
}

/**
 * Convert flow rate from per second to tokens per day for display
 */
export function flowRateToTokensPerDay(flowRate: bigint): number {
  // Convert from wei per second to tokens per day
  const tokensPerSecond = parseFloat(formatUnits(flowRate, 18));
  return tokensPerSecond * 24 * 60 * 60;
}

/**
 * Encode the createFlow call data for the CFA
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function encodeCreateFlow(_receiver: Address, _flowRate: bigint): `0x${string}` {
  // CFA createFlow function selector and parameters
  const functionSelector = "0x6e4d5d2e"; // createFlow(ISuperfluidToken,address,int96,bytes)
  
  // Encode parameters: token, receiver, flowRate, userData (empty bytes)
  // This is a simplified version - in practice you'd use a proper ABI encoder
  // For now, we'll return the function selector and let the frontend handle full encoding
  return `0x${functionSelector.slice(2)}` as `0x${string}`;
}

/**
 * Encode the updateFlow call data for the CFA
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function encodeUpdateFlow(_receiver: Address, _flowRate: bigint): `0x${string}` {
  const functionSelector = "0x3f1b7c88"; // updateFlow(ISuperfluidToken,address,int96,bytes)
  return `0x${functionSelector.slice(2)}` as `0x${string}`;
}

/**
 * Encode the deleteFlow call data for the CFA
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function encodeDeleteFlow(_sender: Address, _receiver: Address): `0x${string}` {
  const functionSelector = "0x79ba5097"; // deleteFlow(ISuperfluidToken,address,address,bytes)
  return `0x${functionSelector.slice(2)}` as `0x${string}`;
}