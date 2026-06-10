// Cast generation + publishing for the @streme bot.
//
// Copy is template-based (deterministic, reviewable) with hard quality
// gates: at low activity the bot says nothing rather than hyping $12 of
// volume. Publishing is dry-run unless explicitly enabled via env, so the
// whole pipeline is safe to deploy and observe before going live.

import { CastDraft, CastRecord, Milestone, PulseSnapshot } from "./types";
import {
  formatCountCompact,
  formatPercentChange,
  formatUsdCompact,
} from "./format";

const FARCASTER_CAST_MAX_BYTES = 1024;

// Daily cast quality gate: need at least this many tokens with real volume.
const DAILY_MIN_QUALIFYING_TOKENS = 1;
const DAILY_MIN_TOKEN_VOLUME_USD = 250;
const DAILY_MAX_TOKENS = 3;

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://streme.fun"
  );
}

export function liveCastingEnabled(): boolean {
  return Boolean(
    process.env.PULSE_CASTS_ENABLED === "true" &&
      process.env.NEYNAR_API_KEY &&
      process.env.STREME_SIGNER_UUID
  );
}

/**
 * Daily pulse cast: top tokens with stats. Returns null when activity is
 * below the quality gate — skipping beats casting embarrassing numbers.
 */
export function buildDailyPulseCast(
  snapshot: PulseSnapshot,
  dateKey: string
): CastDraft | null {
  const qualifying = snapshot.tokens.filter(
    (t) => t.volume24h >= DAILY_MIN_TOKEN_VOLUME_USD
  );
  if (qualifying.length < DAILY_MIN_QUALIFYING_TOKENS) return null;

  const top = qualifying.slice(0, DAILY_MAX_TOKENS);
  const lines = top.map((t, i) => {
    const parts = [formatUsdCompact(t.volume24h) + " vol"];
    if (Math.abs(t.change24h) >= 1) {
      parts.push(formatPercentChange(t.change24h));
    }
    if ((t.totalStakers ?? 0) > 0) {
      parts.push(`${formatCountCompact(t.totalStakers!)} stakers`);
    }
    return `${i + 1}. $${t.symbol} — ${parts.join(" · ")}`;
  });

  const text = trimToBytes(
    [
      `📡 Streme Pulse`,
      ``,
      `Top streaming tokens today:`,
      ...lines,
      ``,
      `Every Streme token streams staking rewards by the second. Stake early, earn the stream.`,
    ].join("\n"),
    FARCASTER_CAST_MAX_BYTES
  );

  return {
    kind: "daily_pulse",
    idem: `daily_pulse:${dateKey}`,
    text,
    embedUrl: `${appUrl()}/pulse`,
  };
}

export function buildMilestoneCast(milestone: Milestone): CastDraft {
  // @mentioning the creator turns every milestone into borrowed
  // distribution — creators reshare their own wins to their own audience.
  const creator = milestone.creatorUsername?.trim();
  const byline = creator ? ` by @${creator}` : "";

  const text = trimToBytes(
    [
      `🌊 $${milestone.symbol}${byline} just crossed ${formatUsdCompact(
        milestone.threshold
      )} market cap on Streme`,
      ``,
      `Holders can stake $${milestone.symbol} to earn streaming rewards every second.`,
    ].join("\n"),
    FARCASTER_CAST_MAX_BYTES
  );

  return {
    kind: "milestone",
    idem: milestone.id,
    text,
    embedUrl: `${appUrl()}/token/${milestone.tokenAddress}`,
  };
}

/**
 * Publish a cast via Neynar as the @streme bot, or record a dry run when
 * live casting is disabled. Never throws — failures become records.
 */
export async function publishCast(
  draft: CastDraft,
  opts: { forceDryRun?: boolean; now?: number } = {}
): Promise<CastRecord> {
  const createdAt = opts.now ?? Math.floor(Date.now() / 1000);

  if (opts.forceDryRun || !liveCastingEnabled()) {
    return { ...draft, status: "dry_run", createdAt };
  }

  try {
    const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "x-api-key": process.env.NEYNAR_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signer_uuid: process.env.STREME_SIGNER_UUID,
        text: draft.text,
        embeds: [{ url: draft.embedUrl }],
        idem: draft.idem.slice(0, 16),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ...draft,
        status: "failed",
        error: `Neynar ${response.status}: ${body.slice(0, 200)}`,
        createdAt,
      };
    }

    const data = await response.json();
    return {
      ...draft,
      status: "published",
      castHash: data?.cast?.hash,
      createdAt,
    };
  } catch (error) {
    return {
      ...draft,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      createdAt,
    };
  }
}

/** Trim to a UTF-8 byte budget without splitting a multi-byte character. */
export function trimToBytes(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) return text;

  // Slice by code points (not UTF-16 units) so surrogate pairs stay intact.
  let points = Array.from(text);
  while (
    points.length > 0 &&
    encoder.encode(points.join("") + "…").length > maxBytes
  ) {
    points = points.slice(0, -1);
  }
  return points.join("") + "…";
}
