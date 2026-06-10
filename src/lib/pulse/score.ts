// StremeScore — a legible, streaming-native trending score.
//
// Every component is bounded and explainable: the final 0-100 score is a
// weighted blend, and each token carries human-readable `reasons` so the
// ranking is never a black box (on the /pulse page, in casts, or in logs).

import { PulseToken, PulseTokenMetrics } from "./types";
import {
  formatAge,
  formatCountCompact,
  formatPercentChange,
  formatUsdCompact,
} from "./format";

const WEIGHTS = {
  volume: 40,
  momentum24h: 22,
  momentum1h: 8,
  freshness: 12,
  tradeRecency: 8,
  stakers: 10,
} as const;

const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

// Reasons only appear above these floors so quiet tokens don't get
// padded with noise like "$3 volume".
const REASON_MIN_VOLUME_USD = 250;
const REASON_MIN_CHANGE_PCT = 5;
const REASON_MIN_STAKERS = 25;
const REASON_MAX_AGE_SECONDS = 72 * 3600;

/** log-scaled 0..1 where `cap` maps to 1 (e.g. $1M daily volume) */
function logUnit(value: number, cap: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, Math.log10(1 + value) / Math.log10(1 + cap));
}

function clampPct(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

export function scoreToken(
  m: PulseTokenMetrics,
  now: number
): { score: number; reasons: string[] } {
  const volume = logUnit(m.volume24h, 1_000_000);

  // Momentum: gains help up to +100%, losses drag down to -50%.
  const momentum24h = clampPct(m.change24h, -50, 100) / 100;
  const momentum1h = clampPct(m.change1h, -50, 100) / 100;

  // Freshness: linear boost for the first 7 days after launch.
  const ageSeconds = Math.max(0, now - m.createdAt);
  const freshness = Math.max(0, 1 - ageSeconds / (7 * 86400));

  // Trade recency: full credit within 24h, fading to 0 over 7 days.
  const sinceTrade = m.lastTradedAt > 0 ? now - m.lastTradedAt : Infinity;
  const tradeRecency =
    sinceTrade <= 86400
      ? 1
      : Math.max(0, 1 - (sinceTrade - 86400) / (6 * 86400));

  const stakers = logUnit(m.totalStakers ?? 0, 1_000);

  const raw =
    volume * WEIGHTS.volume +
    momentum24h * WEIGHTS.momentum24h +
    momentum1h * WEIGHTS.momentum1h +
    freshness * WEIGHTS.freshness +
    tradeRecency * WEIGHTS.tradeRecency +
    stakers * WEIGHTS.stakers;

  const score = Math.max(0, Math.min(100, (raw / MAX_SCORE) * 100));

  const reasons: string[] = [];
  if (m.volume24h >= REASON_MIN_VOLUME_USD) {
    reasons.push(`${formatUsdCompact(m.volume24h)} 24h volume`);
  }
  if (m.change24h >= REASON_MIN_CHANGE_PCT) {
    reasons.push(`${formatPercentChange(m.change24h)} 24h`);
  }
  if (ageSeconds <= REASON_MAX_AGE_SECONDS) {
    reasons.push(`launched ${formatAge(m.createdAt, now)} ago`);
  }
  if ((m.totalStakers ?? 0) >= REASON_MIN_STAKERS) {
    reasons.push(`${formatCountCompact(m.totalStakers!)} stakers`);
  }

  return { score: Math.round(score * 10) / 10, reasons };
}

export function rankTokens(
  metrics: PulseTokenMetrics[],
  now: number,
  limit = 25
): PulseToken[] {
  return metrics
    .map((m) => ({ ...m, ...scoreToken(m, now) }))
    .sort((a, b) => b.score - a.score || b.volume24h - a.volume24h)
    .slice(0, limit)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}
