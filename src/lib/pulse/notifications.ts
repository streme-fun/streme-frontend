// Targeted milestone notifications — "a token you hold just crossed $100k"
// pushed to the Farcaster users who actually hold it. Far better conversion
// than any feed post, and fully automated.
//
// Delivery modes, best first:
//   1. Neynar managed notifications (NEYNAR_API_KEY + NEYNAR_CLIENT_ID) —
//      Neynar holds the notification tokens and fans out per-fid.
//   2. Self-managed tokens from Redis via sendFrameNotification (fallback).
// Like casting, sending is gated behind an env flag and dry-runs otherwise.

import { formatUsdCompact } from "./format";
import { Milestone } from "./types";

const HOLDERS_URL = "https://api.streme.fun/api/stakers";
const MAX_TARGET_FIDS = 100;

export type NotificationMode = "neynar" | "tokens" | "none";

export interface NotificationRecord {
  milestoneId: string;
  title: string;
  body: string;
  targetUrl: string;
  targetCount: number;
  mode: NotificationMode;
  status: "dry_run" | "sent" | "failed" | "skipped";
  error?: string;
  /** Unix seconds */
  createdAt: number;
}

interface HolderDoc {
  hasFarcaster?: boolean;
  farcaster?: { fid?: number };
}

export function notificationsEnabled(): boolean {
  return process.env.PULSE_NOTIFICATIONS_ENABLED === "true";
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://streme.fun"
  );
}

export function buildMilestoneNotification(milestone: Milestone): {
  title: string;
  body: string;
  targetUrl: string;
} {
  return {
    title: `$${milestone.symbol} crossed ${formatUsdCompact(
      milestone.threshold
    )}`,
    body: `A token you hold just hit ${formatUsdCompact(
      milestone.threshold
    )} market cap. Your staking stream keeps flowing — check it out.`,
    targetUrl: `${appUrl()}/token/${milestone.tokenAddress}`,
  };
}

/** Farcaster fids of the token's holders, capped and deduped. */
export async function fetchHolderFids(tokenAddress: string): Promise<number[]> {
  const response = await fetch(`${HOLDERS_URL}/${tokenAddress}`, {
    headers: { Accept: "application/json", "User-Agent": "Streme/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Holders API error: ${response.status}`);
  }

  const holders: HolderDoc[] = await response.json();
  const fids = new Set<number>();
  for (const holder of holders) {
    const fid = holder.farcaster?.fid;
    if (holder.hasFarcaster && typeof fid === "number" && fid > 0) {
      fids.add(fid);
    }
    if (fids.size >= MAX_TARGET_FIDS) break;
  }
  return [...fids];
}

async function sendViaNeynar(
  fids: number[],
  notification: { title: string; body: string; targetUrl: string }
): Promise<void> {
  const response = await fetch(
    "https://api.neynar.com/v2/farcaster/frame/notifications",
    {
      method: "POST",
      headers: {
        "x-api-key": process.env.NEYNAR_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_fids: fids,
        notification: {
          title: notification.title,
          body: notification.body,
          target_url: notification.targetUrl,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Neynar notifications ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaStoredTokens(
  fids: number[],
  notification: { title: string; body: string; targetUrl: string }
): Promise<void> {
  // Lazy import: notifs.ts pulls in @farcaster/miniapp-sdk (ESM-only),
  // which we only want loaded when this fallback path actually runs.
  const { sendFrameNotification } = await import("@/src/lib/notifs");
  for (const fid of fids) {
    await sendFrameNotification({
      fid,
      title: notification.title,
      body: notification.body,
      targetUrl: notification.targetUrl,
    });
  }
}

/**
 * Notify a milestone token's holders. Never throws — failures become
 * records, mirroring publishCast.
 */
export async function notifyMilestoneHolders(
  milestone: Milestone,
  opts: { forceDryRun?: boolean; now?: number } = {}
): Promise<NotificationRecord> {
  const createdAt = opts.now ?? Math.floor(Date.now() / 1000);
  const notification = buildMilestoneNotification(milestone);

  const mode: NotificationMode =
    process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID
      ? "neynar"
      : "tokens";

  const base = {
    milestoneId: milestone.id,
    ...notification,
    mode,
    createdAt,
  };

  let fids: number[] = [];
  try {
    fids = await fetchHolderFids(milestone.tokenAddress);
  } catch (error) {
    return {
      ...base,
      targetCount: 0,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  if (fids.length === 0) {
    return { ...base, targetCount: 0, status: "skipped" };
  }

  if (opts.forceDryRun || !notificationsEnabled()) {
    return { ...base, targetCount: fids.length, status: "dry_run" };
  }

  try {
    if (mode === "neynar") await sendViaNeynar(fids, notification);
    else await sendViaStoredTokens(fids, notification);
    return { ...base, targetCount: fids.length, status: "sent" };
  } catch (error) {
    return {
      ...base,
      targetCount: fids.length,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
