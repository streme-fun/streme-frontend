// Milestone detection — pure functions over snapshot metrics plus a small
// "already announced" state map, so each threshold fires exactly once per
// token across the lifetime of the bot.

import { Milestone, PulseTokenMetrics } from "./types";

export const MARKET_CAP_THRESHOLDS = [
  50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000,
  10_000_000, 50_000_000, 100_000_000,
];

// A market cap crossing only counts if the token actually traded recently —
// stale prices on dead pools can drift across thresholds without any buyer.
const REQUIRE_TRADE_WITHIN_SECONDS = 24 * 3600;

/** Highest threshold at or below the given market cap (0 if below all). */
export function highestCrossedThreshold(marketCap: number): number {
  let crossed = 0;
  for (const threshold of MARKET_CAP_THRESHOLDS) {
    if (marketCap >= threshold) crossed = threshold;
    else break;
  }
  return crossed;
}

/**
 * Detect new market-cap milestones.
 *
 * @param announced map of token address -> highest threshold already announced
 * @returns at most one milestone per token (the highest newly crossed level)
 */
export function detectMarketCapMilestones(
  tokens: PulseTokenMetrics[],
  announced: Record<string, number>,
  now: number
): Milestone[] {
  const milestones: Milestone[] = [];

  for (const token of tokens) {
    const crossed = highestCrossedThreshold(token.marketCap);
    if (crossed === 0) continue;

    const alreadyAnnounced = announced[token.address] ?? 0;
    if (crossed <= alreadyAnnounced) continue;

    const tradedRecently =
      token.lastTradedAt > 0 &&
      now - token.lastTradedAt <= REQUIRE_TRADE_WITHIN_SECONDS;
    if (!tradedRecently) continue;

    milestones.push({
      id: `market_cap:${token.address}:${crossed}`,
      type: "market_cap",
      tokenAddress: token.address,
      symbol: token.symbol,
      name: token.name,
      creatorUsername: token.username,
      threshold: crossed,
      value: token.marketCap,
      detectedAt: now,
    });
  }

  return milestones.sort((a, b) => b.threshold - a.threshold);
}

/**
 * Seed the announced-state map from current metrics without emitting
 * milestones. Used on the first ever run so the bot doesn't spam a
 * celebration for every token that crossed a level months ago.
 */
export function seedAnnouncedState(
  tokens: PulseTokenMetrics[]
): Record<string, number> {
  const announced: Record<string, number> = {};
  for (const token of tokens) {
    const crossed = highestCrossedThreshold(token.marketCap);
    if (crossed > 0) announced[token.address] = crossed;
  }
  return announced;
}
