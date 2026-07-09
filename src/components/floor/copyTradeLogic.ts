// Pure copy-trade logic for the Agent Floor (plan U6) — eligibility matrix,
// stake-amount clamping, REST body shaping, and mini-app tx param shaping.
// No React, no network: CopyTradeButton stays a thin shell over this module
// so the matrix is unit-testable without a wallet.
//
// The copy-trade matrix (review-refined, strict):
//  - Only tier 1/2 events are copyable — tier 3 (watermark-only, spoofable)
//    gets NO control at all (spoofed-honeypot guard).
//  - Only buy and stake are copyable. Replaying an unstake would send funds
//    to the original agent's `to`; replaying a stream opens an unbounded
//    payment to the original receiver. stake_refunded/connect: no control.
//  - BUY copy rebuilds with a fresh server-side quote at the original ETH
//    size. STAKE copy clamps to the viewer's balance (never build a doomed
//    stake); zero balance becomes "buy & auto-stake instead" with an
//    editable ETH preset.

import { formatEther, parseEther } from "viem";
import type { UnsignedTx } from "@/src/lib/agent/txBuilders";
import type { FloorEvent } from "@/src/lib/floor/store";

/** Default ETH size for the buy-substitute path (editable in the confirm UI). */
export const DEFAULT_BUY_SUBSTITUTE_ETH = "0.01";

/** Risk framing shown on every confirm step before signing (origin R9). */
export const COPY_TRADE_RISK_COPY =
  "Agent activity is not financial advice. You're signing your own " +
  "transaction at current market conditions — the price may differ from " +
  "the original trade.";

const BASE_CHAIN_ID_HEX = "0x2105"; // 8453

type EligibilityInput = Pick<
  FloorEvent,
  "tier" | "kind" | "token" | "amountEth"
>;

/**
 * The eligibility matrix. True only when ALL hold:
 *  - tier 1 or 2 (never tier 3)
 *  - kind buy or stake
 *  - a token address is present
 *  - buys additionally need the original ETH amount (nothing to replay
 *    without it)
 */
export function isCopyEligible(event: EligibilityInput): boolean {
  if (event.tier !== 1 && event.tier !== 2) return false;
  if (!event.token) return false;
  if (event.kind === "buy") return Boolean(event.amountEth);
  return event.kind === "stake";
}

/** How a stake copy resolves once the viewer's balance is known. */
export type StakeCopyResolution =
  | {
      mode: "stake";
      /** Amount to stake, in wei */
      amountWei: bigint;
      /** Same amount as a decimal token string (the REST builder's format) */
      amountTokens: string;
      /** True when clamped down to the viewer's balance */
      clamped: boolean;
    }
  | { mode: "buy_substitute" };

/**
 * Clamp matrix for stake copies:
 *  - balance >= original         → stake the original amount
 *  - 0 < balance < original      → clamp to the viewer's balance
 *  - balance == 0                → buy-substitute mode
 * A missing/unparseable original amount also falls back to buy-substitute —
 * never guess a stake size the original event doesn't state.
 */
export function resolveStakeAmount(
  balanceWei: bigint,
  originalTokens: string | undefined
): StakeCopyResolution {
  if (balanceWei <= 0n) return { mode: "buy_substitute" };

  let originalWei = 0n;
  try {
    originalWei = parseEther(originalTokens ?? "");
  } catch {
    originalWei = 0n;
  }
  if (originalWei <= 0n) return { mode: "buy_substitute" };

  const amountWei = balanceWei >= originalWei ? originalWei : balanceWei;
  return {
    mode: "stake",
    amountWei,
    amountTokens: formatEther(amountWei),
    clamped: amountWei < originalWei,
  };
}

/** A shaped call to POST /api/agent/tx/[action]. */
export interface CopyBuildRequest {
  action: "buy" | "stake";
  body: Record<string, unknown>;
}

/** BUY copy: original ETH size + original staked flag, fresh quote server-side. */
export function shapeBuyCopyRequest(
  event: Pick<FloorEvent, "token" | "amountEth" | "staked">
): CopyBuildRequest {
  return {
    action: "buy",
    body: {
      tokenAddress: event.token,
      ethAmount: event.amountEth,
      stake: event.staked === true,
      source: "floor-ui",
    },
  };
}

/** STAKE copy at a resolved (possibly clamped) decimal token amount. */
export function shapeStakeCopyRequest(
  event: Pick<FloorEvent, "token">,
  amountTokens: string
): CopyBuildRequest {
  return {
    action: "stake",
    body: {
      tokenAddress: event.token,
      amount: amountTokens,
      source: "floor-ui",
    },
  };
}

/** Buy-substitute for a stake the viewer can't make: buy + auto-stake. */
export function shapeBuySubstituteRequest(
  event: Pick<FloorEvent, "token">,
  ethAmount: string
): CopyBuildRequest {
  return {
    action: "buy",
    body: {
      tokenAddress: event.token,
      ethAmount,
      stake: true,
      source: "floor-ui",
    },
  };
}

/** 8453 → "0x2105" (and any other numeric chain id → hex string). */
export function toChainIdHex(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}

export interface MiniAppTxParams {
  to: `0x${string}`;
  from: `0x${string}`;
  data: `0x${string}`;
  value?: `0x${string}`;
  /** Always the hex string form — mini-app eth_sendTransaction requires it */
  chainId: `0x${string}`;
}

/**
 * Shape a gateway-built tx for the mini-app `eth_sendTransaction` path:
 * numeric chainId (8453) becomes "0x2105", `value` (hex wei) passes through
 * only when present, calldata is untouched.
 */
export function shapeMiniAppTxParams(
  tx: UnsignedTx,
  from: string
): MiniAppTxParams {
  return {
    to: tx.to,
    from: from as `0x${string}`,
    data: tx.data,
    ...(tx.value ? { value: tx.value } : {}),
    chainId: tx.chainId ? toChainIdHex(tx.chainId) : BASE_CHAIN_ID_HEX,
  };
}

/** Sanitized user-entered ETH amount for the buy-substitute input, or null. */
export function parseEthInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d*\.?\d+$/.test(trimmed)) return null;
  try {
    return parseEther(trimmed) > 0n ? trimmed : null;
  } catch {
    return null;
  }
}
