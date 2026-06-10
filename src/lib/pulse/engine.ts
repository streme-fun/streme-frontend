// The Pulse engine — one run does:
//   1. fetch + rank tokens with the StremeScore (legible trending)
//   2. enrich the leaders with live staking data from the Superfluid subgraph
//   3. detect market-cap milestones (once-ever per token per threshold)
//   4. build + publish bot casts (daily pulse, milestone celebrations)
//   5. persist everything for the /pulse page and the bot activity log
//
// Side effects are layered: computeSnapshot() is read-only (safe for the
// public API to call as a fallback), runPulse() owns state + casting.

import { SPAMMER_BLACKLIST, BLACKLISTED_TOKENS } from "@/src/lib/blacklist";
import { fetchBatchPoolData } from "@/src/lib/rewards";
import { rankTokens, scoreToken } from "./score";
import {
  detectMarketCapMilestones,
  seedAnnouncedState,
} from "./milestones";
import {
  buildDailyPulseCast,
  buildMilestoneCast,
  publishCast,
  liveCastingEnabled,
} from "./casts";
import { polishCastDraft } from "./ai";
import {
  NotificationRecord,
  notifyMilestoneHolders,
} from "./notifications";
import * as store from "./store";
import {
  CastDraft,
  CastRecord,
  PulseRunReport,
  PulseSnapshot,
  PulseTokenMetrics,
} from "./types";

const TRENDING_URL = "https://api.streme.fun/api/tokens/trending?type=all";
const SNAPSHOT_SIZE = 25;
const ENRICH_POOL_COUNT = 30;
const MAX_MILESTONE_CASTS_PER_RUN = 2;
const DAILY_CAST_HOUR_UTC = 16;

interface UpstreamToken {
  contract_address?: string;
  name?: string;
  symbol?: string;
  img_url?: string | null;
  username?: string;
  staking_pool?: string;
  timestamp?: { _seconds?: number };
  lastTraded?: { _seconds?: number };
  marketData?: {
    marketCap?: number;
    price?: number;
    volume24h?: number;
    priceChange1h?: number;
    priceChange24h?: number;
  };
}

function toMetrics(token: UpstreamToken, now: number): PulseTokenMetrics | null {
  const address = token.contract_address?.toLowerCase();
  if (!address || !token.symbol || !token.name) return null;

  // Upstream marketData is only refreshed for tokens that trade, so "24h"
  // figures on a token with no trade in 24h are historical leftovers.
  // Zero them at ingestion so scores, casts, and the page stay honest.
  const lastTradedAt = token.lastTraded?._seconds ?? 0;
  const tradedRecently = lastTradedAt > 0 && now - lastTradedAt <= 86400;

  const market = token.marketData ?? {};
  return {
    address,
    name: token.name,
    symbol: token.symbol.startsWith("$")
      ? token.symbol.substring(1)
      : token.symbol,
    img_url: token.img_url ?? null,
    username: token.username,
    createdAt: token.timestamp?._seconds ?? 0,
    lastTradedAt,
    marketCap: market.marketCap ?? 0,
    price: market.price ?? 0,
    volume24h: tradedRecently ? market.volume24h ?? 0 : 0,
    change1h: tradedRecently ? market.priceChange1h ?? 0 : 0,
    change24h: tradedRecently ? market.priceChange24h ?? 0 : 0,
    stakingPool: token.staking_pool?.toLowerCase(),
  };
}

async function fetchTrendingMetrics(now: number): Promise<PulseTokenMetrics[]> {
  const response = await fetch(TRENDING_URL, {
    headers: { Accept: "application/json", "User-Agent": "Streme/1.0" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Trending API error: ${response.status}`);
  }

  const tokens: UpstreamToken[] = await response.json();
  return tokens
    .filter((t) => {
      if (t.username && SPAMMER_BLACKLIST.includes(t.username.toLowerCase()))
        return false;
      if (
        t.contract_address &&
        BLACKLISTED_TOKENS.includes(t.contract_address.toLowerCase())
      )
        return false;
      return true;
    })
    .map((t) => toMetrics(t, now))
    .filter((m): m is PulseTokenMetrics => m !== null);
}

async function enrichWithPoolStats(
  metrics: PulseTokenMetrics[]
): Promise<void> {
  const pools = metrics
    .map((m) => m.stakingPool)
    .filter((p): p is string => Boolean(p));
  if (pools.length === 0) return;

  const poolData = await fetchBatchPoolData(pools, 1);
  for (const m of metrics) {
    const data = m.stakingPool ? poolData[m.stakingPool] : undefined;
    if (!data) continue;
    m.totalStakers = parseInt(data.totalMembers) || 0;
    const flowRate = parseFloat(data.flowRate) || 0;
    m.rewardFlowPerDay = (flowRate / 1e18) * 86400;
  }
}

/** Read-only: fetch, score, enrich, and assemble a snapshot. */
export async function computeSnapshot(now: number): Promise<PulseSnapshot> {
  const allMetrics = await fetchTrendingMetrics(now);

  // Pre-rank to bound the subgraph query, enrich the leaders with staking
  // data, then re-rank so staker counts can influence the final order.
  const leaders = rankTokens(allMetrics, now, ENRICH_POOL_COUNT);
  try {
    await enrichWithPoolStats(leaders);
  } catch (error) {
    console.warn("[Pulse] Pool enrichment failed, continuing without:", error);
  }
  const tokens = rankTokens(leaders, now, SNAPSHOT_SIZE);

  const totals = {
    trackedTokens: allMetrics.length,
    activeTokens24h: allMetrics.filter(
      (m) => m.lastTradedAt > 0 && now - m.lastTradedAt <= 86400
    ).length,
    volume24h: allMetrics.reduce((sum, m) => sum + (m.volume24h || 0), 0),
    marketCap: allMetrics.reduce((sum, m) => sum + (m.marketCap || 0), 0),
    launches7d: allMetrics.filter(
      (m) => m.createdAt > 0 && now - m.createdAt <= 7 * 86400
    ).length,
  };

  return { generatedAt: now, tokens, totals };
}

export interface RunPulseOptions {
  now?: Date;
  forceDryRun?: boolean;
}

export async function runPulse(
  opts: RunPulseOptions = {}
): Promise<PulseRunReport> {
  const startedMs = Date.now();
  const nowDate = opts.now ?? new Date();
  const now = Math.floor(nowDate.getTime() / 1000);
  // forceDryRun is a pure preview: report what a live run would do, but
  // write no engine state so it can never consume or suppress a real
  // broadcast. (The snapshot is still refreshed — it's idempotent data.)
  const persist = !opts.forceDryRun;
  const errors: string[] = [];
  const casts: CastRecord[] = [];
  const notifications: NotificationRecord[] = [];
  let newMilestones = 0;

  const snapshot = await computeSnapshot(now);
  await store.setLatestSnapshot(snapshot);

  // --- Milestones ---------------------------------------------------------
  try {
    const announced = await store.getAnnouncedThresholds();
    const allMetrics = snapshot.tokens as PulseTokenMetrics[];

    if (announced === null) {
      // First ever run: record current levels silently so the bot doesn't
      // celebrate months-old crossings.
      if (persist) {
        await store.setAnnouncedThresholds(seedAnnouncedState(allMetrics));
      }
    } else {
      const milestones = detectMarketCapMilestones(allMetrics, announced, now);
      newMilestones = milestones.length;

      if (milestones.length > 0) {
        if (persist) {
          for (const m of milestones) {
            announced[m.tokenAddress] = Math.max(
              announced[m.tokenAddress] ?? 0,
              m.threshold
            );
          }
          await store.setAnnouncedThresholds(announced);
          await store.appendMilestones(milestones);
        }

        const announcedNow = milestones.slice(0, MAX_MILESTONE_CASTS_PER_RUN);
        for (const milestone of announcedNow) {
          casts.push(
            await publishCast(
              await polishCastDraft(buildMilestoneCast(milestone)),
              { forceDryRun: opts.forceDryRun, now }
            )
          );
          // Push the same milestone to its holders' devices — the
          // highest-conversion surface we have.
          notifications.push(
            await notifyMilestoneHolders(milestone, {
              forceDryRun: opts.forceDryRun,
              now,
            })
          );
        }
      }
    }
  } catch (error) {
    errors.push(
      `milestones: ${error instanceof Error ? error.message : "unknown"}`
    );
  }

  // --- Daily pulse cast ---------------------------------------------------
  try {
    const dateKey = nowDate.toISOString().slice(0, 10);
    if (
      nowDate.getUTCHours() >= DAILY_CAST_HOUR_UTC &&
      !(await store.wasDailyCastHandled(dateKey))
    ) {
      const draft = buildDailyPulseCast(snapshot, dateKey);
      if (draft) {
        casts.push(
          await publishCast(await polishCastDraft(draft), {
            forceDryRun: opts.forceDryRun,
            now,
          })
        );
      } else {
        casts.push(skippedRecord(dateKey, now));
      }
      if (persist) await store.markDailyCastHandled(dateKey);
    }
  } catch (error) {
    errors.push(
      `daily_cast: ${error instanceof Error ? error.message : "unknown"}`
    );
  }

  if (persist) {
    await store.appendCastRecords(casts);
    await store.appendNotificationRecords(notifications);
  }

  const report: PulseRunReport = {
    ranAt: now,
    durationMs: Date.now() - startedMs,
    tokensTracked: snapshot.totals.trackedTokens,
    newMilestones,
    casts,
    notifications,
    liveCasting: !opts.forceDryRun && liveCastingEnabled(),
    errors,
  };

  await notifySlack(report);
  return report;
}

function skippedRecord(dateKey: string, now: number): CastRecord {
  const draft: CastDraft = {
    kind: "daily_pulse",
    idem: `daily_pulse:${dateKey}`,
    text: "(skipped — 24h activity below quality gate)",
    embedUrl: "",
  };
  return { ...draft, status: "skipped", createdAt: now };
}

/** Optional ops alerting: post run outcomes to Slack when configured. */
async function notifySlack(report: PulseRunReport): Promise<void> {
  const webhook = process.env.PULSE_SLACK_WEBHOOK;
  if (!webhook) return;

  const published = report.casts.filter((c) => c.status === "published");
  const failed = report.casts.filter((c) => c.status === "failed");
  const notifSent = report.notifications.filter((n) => n.status === "sent");
  const notifFailed = report.notifications.filter((n) => n.status === "failed");
  if (
    published.length === 0 &&
    failed.length === 0 &&
    notifSent.length === 0 &&
    notifFailed.length === 0 &&
    report.errors.length === 0
  )
    return;

  const lines = [
    `Streme Pulse run: ${report.tokensTracked} tokens, ${report.newMilestones} new milestones`,
    ...published.map((c) => `✅ cast published (${c.kind}): ${c.castHash ?? ""}`),
    ...failed.map((c) => `❌ cast failed (${c.kind}): ${c.error ?? ""}`),
    ...notifSent.map(
      (n) => `🔔 notified ${n.targetCount} holders (${n.milestoneId})`
    ),
    ...notifFailed.map(
      (n) => `❌ notifications failed (${n.milestoneId}): ${n.error ?? ""}`
    ),
    ...report.errors.map((e) => `⚠️ ${e}`),
  ];

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.warn("[Pulse] Slack notification failed:", error);
  }
}

// Re-exported so API routes import a single module.
export { scoreToken };
