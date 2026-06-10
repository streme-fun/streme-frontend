// Unsigned transaction builders for the agent gateway.
//
// Custody model: Streme never holds keys. Every builder returns calldata for
// the agent's OWN wallet to sign and broadcast — the same transactions the
// UI buttons produce, expressed as data. chainId is always Base (8453).

import { encodeFunctionData, parseAbi, parseEther, type Hex } from "viem";
import {
  encodeSuperTokenSendData,
  encodeUnstakeData,
  encodeZapData,
  encodeConnectPoolData,
} from "@/src/lib/abiEncoding";
import { ZAP_CONTRACT_ADDRESS } from "@/src/lib/contracts";
import { CFA_V1_FORWARDER } from "@/src/lib/superfluid-contracts";
import { publicClient } from "@/src/lib/viemClient";
import { encodeWatermark, type WatermarkSource } from "./watermark";

type Address = `0x${string}`;

/**
 * Attribution options every builder accepts. The watermark rides in ERC777/
 * GDA `userData` where the call has one (stake, connect-pool) and as inert
 * trailing calldata otherwise (buy, unstake, stream) — see watermark.ts.
 */
export interface WatermarkOptions {
  /** Self-declared agent identifier; sanitized, hashed into the watermark */
  agentId?: string;
  /** Who built this tx (default "agent") */
  source?: WatermarkSource;
}

/** Append the watermark after ABI-encoded calldata (trailing bytes are inert). */
function withWatermarkSuffix(data: Hex, params: WatermarkOptions): Hex {
  return (data + encodeWatermark(params).slice(2)) as Hex;
}

// Same helper the UI StakeButton uses (auto-stakes on ERC777 receipt).
export const STAKING_HELPER: Address =
  "0x6C3D0E968d3C986886EEECA6Ba6Fecc949F17F6e";

const WETH: Address = "0x4200000000000000000000000000000000000006";
const UNI_QUOTER: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const AERO_QUOTER: Address = "0x3d4C22254F86f64B7eC90ab8F7aeC1FBFD271c6C";

export const BASE_CHAIN_ID = 8453;

export interface UnsignedTx {
  to: Address;
  data: `0x${string}`;
  /** Hex wei value; omitted when zero */
  value?: `0x${string}`;
  chainId: number;
}

export interface BuiltTransaction {
  description: string;
  tx: UnsignedTx;
  notes: string[];
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function assertAddress(value: string, label: string): Address {
  if (!ADDRESS_RE.test(value)) {
    throw new AgentInputError(`${label} must be a 0x-prefixed address`);
  }
  return value.toLowerCase() as Address;
}

export class AgentInputError extends Error {}

function parseAmount(value: string, label: string): bigint {
  let amount: bigint;
  try {
    amount = parseEther(value);
  } catch {
    throw new AgentInputError(
      `${label} must be a decimal token amount string, e.g. "1000" or "0.5"`
    );
  }
  if (amount <= 0n) {
    throw new AgentInputError(`${label} must be greater than zero`);
  }
  return amount;
}

const QUOTER_UNI_ABI = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const QUOTER_AERO_ABI = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; int24 tickSpacing; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

/** Quote ETH→token on the token's pool and apply slippage (0.5% default). */
export async function quoteBuyAmountOut(
  tokenAddress: Address,
  ethAmountWei: bigint,
  lpType: "uniswap" | "aero"
): Promise<bigint> {
  const result =
    lpType === "aero"
      ? await publicClient.readContract({
          address: AERO_QUOTER,
          abi: QUOTER_AERO_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: WETH,
              tokenOut: tokenAddress,
              amountIn: ethAmountWei,
              tickSpacing: 500,
              sqrtPriceLimitX96: 0n,
            },
          ],
        })
      : await publicClient.readContract({
          address: UNI_QUOTER,
          abi: QUOTER_UNI_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: WETH,
              tokenOut: tokenAddress,
              amountIn: ethAmountWei,
              fee: 10000,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });
  return (result as readonly [bigint, bigint, number, bigint])[0];
}

/**
 * Buy a token with ETH via the Streme zap (optionally auto-staking in the
 * same transaction). `quotedAmountOut` is injectable for tests.
 */
export async function buildBuyTx(
  params: {
    tokenAddress: string;
    ethAmount: string;
    stake?: boolean;
    stakingAddress?: string;
    lpType?: "uniswap" | "aero";
    slippageBps?: number;
    quotedAmountOut?: bigint;
  } & WatermarkOptions
): Promise<BuiltTransaction> {
  const token = assertAddress(params.tokenAddress, "tokenAddress");
  const ethWei = parseAmount(params.ethAmount, "ethAmount");
  const slippageBps = params.slippageBps ?? 50;
  if (slippageBps < 1 || slippageBps > 5000) {
    throw new AgentInputError("slippageBps must be between 1 and 5000");
  }

  const stake = params.stake ?? false;
  const stakingAddress = stake
    ? assertAddress(
        params.stakingAddress ?? "",
        "stakingAddress (required when stake=true)"
      )
    : ("0x0000000000000000000000000000000000000000" as Address);

  const amountOut =
    params.quotedAmountOut ??
    (await quoteBuyAmountOut(token, ethWei, params.lpType ?? "uniswap"));
  const amountOutMin = amountOut - (amountOut * BigInt(slippageBps)) / 10_000n;

  const data = withWatermarkSuffix(
    encodeZapData("zap", token, ethWei, amountOutMin, stakingAddress),
    params
  );

  return {
    description: `Buy ${params.ethAmount} ETH worth of the token via Streme zap${
      stake ? " and auto-stake the output" : ""
    }`,
    tx: {
      to: ZAP_CONTRACT_ADDRESS as Address,
      data,
      value: `0x${ethWei.toString(16)}`,
      chainId: BASE_CHAIN_ID,
    },
    notes: [
      `amountOutMin is set with ${slippageBps} bps slippage from the live quote`,
      stake
        ? "Output is staked automatically; rewards stream to the sender every second"
        : "Pass stake=true with the token's stakingAddress to auto-stake in the same transaction",
    ],
  };
}

/**
 * Stake tokens by sending them to the StakingHelper (ERC777 `send` — no
 * approval needed; the helper auto-stakes back to the sender).
 */
export function buildStakeTx(
  params: { tokenAddress: string; amount: string } & WatermarkOptions
): BuiltTransaction {
  const token = assertAddress(params.tokenAddress, "tokenAddress");
  const amount = parseAmount(params.amount, "amount");

  return {
    description: `Stake ${params.amount} tokens — a single send() to the StakingHelper, no approval needed`,
    tx: {
      to: token,
      // Watermark rides in the ERC777 userData (the helper ignores it; it
      // surfaces in the Sent event log, surviving calldata wrapping).
      data: encodeSuperTokenSendData(STAKING_HELPER, amount, encodeWatermark(params)),
      chainId: BASE_CHAIN_ID,
    },
    notes: [
      "Staked tokens have a short lock (typically 24h, reset on each stake)",
      "After staking, call build_connect_pool_transaction once per token so streamed rewards appear in the wallet balance",
    ],
  };
}

/** Unstake from a token's staking contract back to the wallet. */
export function buildUnstakeTx(
  params: { stakingAddress: string; to: string; amount: string } & WatermarkOptions
): BuiltTransaction {
  const staking = assertAddress(params.stakingAddress, "stakingAddress");
  const to = assertAddress(params.to, "to");
  const amount = parseAmount(params.amount, "amount");

  return {
    description: `Unstake ${params.amount} staked tokens back to ${params.to}`,
    tx: {
      to: staking,
      data: withWatermarkSuffix(encodeUnstakeData(to, amount), params),
      chainId: BASE_CHAIN_ID,
    },
    notes: ["Reverts while the deposit lock (typically 24h) is active"],
  };
}

const CONNECT_POOL_ABI_NOTE =
  "Connecting a GDA pool makes already-earned streaming rewards show up in the wallet's token balance";

/** Connect the wallet to a token's GDA reward pool (one-time per token). */
export function buildConnectPoolTx(
  params: { poolAddress: string } & WatermarkOptions
): BuiltTransaction {
  const pool = assertAddress(params.poolAddress, "poolAddress");

  return {
    description: "Connect to the token's reward pool (GDA forwarder)",
    tx: {
      to: "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08", // GDA v1 forwarder (Base)
      // Watermark rides in the GDA userData (surfaces in PoolConnectionUpdated).
      data: encodeConnectPoolData(pool, encodeWatermark(params)),
      chainId: BASE_CHAIN_ID,
    },
    notes: [CONNECT_POOL_ABI_NOTE],
  };
}

const CFA_SET_FLOWRATE_ABI = parseAbi([
  "function setFlowrate(address token, address receiver, int96 flowrate) returns (bool)",
]);

/**
 * Open, update, or close a continuous money stream (Superfluid CFA).
 * tokensPerDay = "0" closes the stream.
 */
export function buildStreamTx(
  params: {
    tokenAddress: string;
    receiver: string;
    tokensPerDay: string;
  } & WatermarkOptions
): BuiltTransaction {
  const token = assertAddress(params.tokenAddress, "tokenAddress");
  const receiver = assertAddress(params.receiver, "receiver");

  let perDay: bigint;
  try {
    perDay = parseEther(params.tokensPerDay);
  } catch {
    throw new AgentInputError(
      `tokensPerDay must be a decimal token amount string, e.g. "100" (use "0" to stop the stream)`
    );
  }
  if (perDay < 0n) throw new AgentInputError("tokensPerDay must be >= 0");

  const flowrate = perDay / 86400n; // wei per second

  const data = withWatermarkSuffix(
    encodeFunctionData({
      abi: CFA_SET_FLOWRATE_ABI,
      functionName: "setFlowrate",
      args: [token, receiver, flowrate],
    }),
    params
  );

  return {
    description:
      perDay === 0n
        ? `Stop the stream to ${params.receiver}`
        : `Stream ${params.tokensPerDay} tokens/day to ${params.receiver}, paid every second`,
    tx: {
      to: CFA_V1_FORWARDER,
      data,
      chainId: BASE_CHAIN_ID,
    },
    notes: [
      "setFlowrate creates, updates, or (at 0) deletes the stream in one call",
      "Streams run until changed — the sender's balance drains continuously",
    ],
  };
}
