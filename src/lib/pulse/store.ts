// Pulse state persistence. Uses Upstash Redis when KV env vars are present
// (same convention as src/lib/kv.ts), with an in-memory fallback so local
// dev and tests work with zero configuration.

import { Redis } from "@upstash/redis";
import { NotificationRecord } from "./notifications";
import { CastRecord, Milestone, PulseSnapshot } from "./types";

const KEY_PREFIX = "streme:pulse";
const HISTORY_LIMIT = 50;
const DAILY_FLAG_TTL_SECONDS = 3 * 86400;

const localStore = new Map<string, unknown>();

const useRedis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

async function get<T>(key: string): Promise<T | null> {
  if (redis) return await redis.get<T>(key);
  return (localStore.get(key) as T) ?? null;
}

async function set(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  if (redis) {
    if (ttlSeconds) await redis.set(key, value, { ex: ttlSeconds });
    else await redis.set(key, value);
  } else {
    localStore.set(key, value);
  }
}

export async function getLatestSnapshot(): Promise<PulseSnapshot | null> {
  return get<PulseSnapshot>(`${KEY_PREFIX}:snapshot`);
}

export async function setLatestSnapshot(
  snapshot: PulseSnapshot
): Promise<void> {
  await set(`${KEY_PREFIX}:snapshot`, snapshot);
}

/**
 * Highest announced market-cap threshold per token address.
 * Returns null when the engine has never run (callers should seed).
 */
export async function getAnnouncedThresholds(): Promise<Record<
  string,
  number
> | null> {
  return get<Record<string, number>>(`${KEY_PREFIX}:announced`);
}

export async function setAnnouncedThresholds(
  announced: Record<string, number>
): Promise<void> {
  await set(`${KEY_PREFIX}:announced`, announced);
}

export async function getRecentMilestones(): Promise<Milestone[]> {
  return (await get<Milestone[]>(`${KEY_PREFIX}:milestones`)) ?? [];
}

export async function appendMilestones(
  milestones: Milestone[]
): Promise<void> {
  if (milestones.length === 0) return;
  const existing = await getRecentMilestones();
  const merged = [...milestones, ...existing].slice(0, HISTORY_LIMIT);
  await set(`${KEY_PREFIX}:milestones`, merged);
}

export async function getRecentCasts(): Promise<CastRecord[]> {
  return (await get<CastRecord[]>(`${KEY_PREFIX}:casts`)) ?? [];
}

export async function appendCastRecords(
  records: CastRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const existing = await getRecentCasts();
  const merged = [...records, ...existing].slice(0, HISTORY_LIMIT);
  await set(`${KEY_PREFIX}:casts`, merged);
}

export async function getRecentNotifications(): Promise<NotificationRecord[]> {
  return (await get<NotificationRecord[]>(`${KEY_PREFIX}:notifications`)) ?? [];
}

export async function appendNotificationRecords(
  records: NotificationRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const existing = await getRecentNotifications();
  const merged = [...records, ...existing].slice(0, HISTORY_LIMIT);
  await set(`${KEY_PREFIX}:notifications`, merged);
}

export async function wasDailyCastHandled(dateKey: string): Promise<boolean> {
  return (await get<boolean>(`${KEY_PREFIX}:daily:${dateKey}`)) === true;
}

export async function markDailyCastHandled(dateKey: string): Promise<void> {
  await set(`${KEY_PREFIX}:daily:${dateKey}`, true, DAILY_FLAG_TTL_SECONDS);
}

/** Test helper — clears the in-memory fallback store. */
export function __clearLocalStoreForTests(): void {
  localStore.clear();
}
