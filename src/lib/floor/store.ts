// Floor persistence — gateway telemetry, fingerprint records, and daily
// counters for the Agent Floor.
//
// Modeled on src/lib/pulse/store.ts (env-gated Upstash Redis, in-memory
// fallback for dev/tests) with two deliberate differences:
//
//  1. Capped lists use LPUSH + LTRIM and counters use INCR + EXPIRE — the
//     pulse store's read-modify-write of whole arrays is racy under the
//     gateway's concurrent invocations.
//  2. Production guard (plan R22). This deliberately overrides the origin
//     brainstorm's in-memory-fallback assumption: cursor/counter state
//     cannot be reconstructed from per-invocation memory on serverless, so
//     in production with no Redis env every read/write no-ops behind ONE
//     prominent console.error (per process, not per call) — never a silent
//     in-memory fallback. Outside production the in-memory fallback keeps
//     dev and tests zero-config, exactly like the pulse store.
//
// The watcher (U4) will add events/cursor/lock helpers here later.

import type { Redis } from "@upstash/redis";

const KEY_PREFIX = "streme:floor";
const TELEMETRY_KEY = `${KEY_PREFIX}:telemetry`;
const TELEMETRY_CAP = 500;
/** Fingerprints live 48h — agents may sign long after building. */
const FINGERPRINT_TTL_SECONDS = 48 * 3600;
const DAILY_COUNTER_TTL_SECONDS = 3 * 86400;

export interface FloorTelemetryEntry {
  tool: string;
  /** Short hash of the call params — never the raw params (plan R5). */
  paramsDigest: string;
  /** Sanitized self-declared agentId, or null */
  agentId: string | null;
  /** Epoch ms at call time */
  at: number;
}

export interface FingerprintRecord {
  tool: string;
  /** Sanitized self-declared agentId, or null */
  agentId: string | null;
  /** Epoch ms when the gateway built the tx */
  builtAt: number;
  /** Watermark nonce (4-byte hex) found in the built data, or null */
  nonce: string | null;
}

/** UTC date key ("YYYY-MM-DD") used for daily counter keys. */
export function floorDateKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

// Lazy Redis construction: @upstash/redis (untransformed ESM) is only
// imported when both env vars are present, so dev/test runs never load it.
let redisPromise: Promise<Redis> | null = null;

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function getRedis(): Promise<Redis | null> {
  const env = redisEnv();
  if (!env) return null;
  if (!redisPromise) {
    redisPromise = import("@upstash/redis").then(
      ({ Redis }) => new Redis({ url: env.url, token: env.token })
    );
  }
  return redisPromise;
}

function isProduction(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

let warnedMissingRedisInProd = false;

/**
 * True when the store must no-op: production with no Redis configured.
 * Logs one prominent error per process — never per call (plan R22).
 */
function productionGuardTripped(): boolean {
  if (redisEnv()) return false;
  if (!isProduction()) return false;
  if (!warnedMissingRedisInProd) {
    warnedMissingRedisInProd = true;
    console.error(
      "[floor/store] KV_REST_API_URL/KV_REST_API_TOKEN are not set in production — " +
        "Agent Floor persistence is DISABLED. Every floor read/write no-ops " +
        "until Redis is configured (the in-memory fallback is dev/test only)."
    );
  }
  return true;
}

// In-memory fallback (dev/test only — the production guard above keeps this
// out of prod). TTLs are ignored here, same as the pulse store.
const memLists = new Map<string, string[]>();
const memValues = new Map<string, string>();
const memCounters = new Map<string, number>();

// ---------------------------------------------------------------------------
// Telemetry list + daily counters
// ---------------------------------------------------------------------------

/**
 * Append a tool-call telemetry entry (capped list, newest first) and bump
 * the day's call counter.
 */
export async function recordToolCall(
  entry: FloorTelemetryEntry
): Promise<void> {
  if (productionGuardTripped()) return;
  const counterKey = `${KEY_PREFIX}:counters:calls:${floorDateKey(entry.at)}`;
  const serialized = JSON.stringify(entry);

  const redis = await getRedis();
  if (redis) {
    await redis.lpush(TELEMETRY_KEY, serialized);
    await redis.ltrim(TELEMETRY_KEY, 0, TELEMETRY_CAP - 1);
    await redis.incr(counterKey);
    await redis.expire(counterKey, DAILY_COUNTER_TTL_SECONDS);
  } else {
    const list = memLists.get(TELEMETRY_KEY) ?? [];
    list.unshift(serialized);
    if (list.length > TELEMETRY_CAP) list.length = TELEMETRY_CAP;
    memLists.set(TELEMETRY_KEY, list);
    memCounters.set(counterKey, (memCounters.get(counterKey) ?? 0) + 1);
  }
}

/** Tool calls recorded on a UTC date ("YYYY-MM-DD"); 0 outside the 3-day TTL. */
export async function getDailyCallCount(date: string): Promise<number> {
  if (productionGuardTripped()) return 0;
  const counterKey = `${KEY_PREFIX}:counters:calls:${date}`;
  const redis = await getRedis();
  if (redis) return (await redis.get<number>(counterKey)) ?? 0;
  return memCounters.get(counterKey) ?? 0;
}

function parseTelemetryEntry(raw: unknown): FloorTelemetryEntry | null {
  try {
    // The Upstash client may auto-deserialize JSON list values; the
    // in-memory path always stores strings. Tolerate both.
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      value &&
      typeof value === "object" &&
      typeof (value as FloorTelemetryEntry).tool === "string"
    ) {
      return value as FloorTelemetryEntry;
    }
  } catch {
    // Malformed entry — drop it rather than failing the whole read.
  }
  return null;
}

/** Most recent telemetry entries, newest first. */
export async function getRecentTelemetry(
  limit = 50
): Promise<FloorTelemetryEntry[]> {
  if (productionGuardTripped()) return [];
  const redis = await getRedis();
  const raw = redis
    ? await redis.lrange(TELEMETRY_KEY, 0, limit - 1)
    : (memLists.get(TELEMETRY_KEY) ?? []).slice(0, limit);
  return raw
    .map(parseTelemetryEntry)
    .filter((entry): entry is FloorTelemetryEntry => entry !== null);
}

// ---------------------------------------------------------------------------
// Fingerprint records + nonce index
// ---------------------------------------------------------------------------

/** Store a fingerprint record under `streme:floor:fp:<fp>` (48h TTL). */
export async function putFingerprint(
  fp: string,
  record: FingerprintRecord
): Promise<void> {
  if (productionGuardTripped()) return;
  const key = `${KEY_PREFIX}:fp:${fp.toLowerCase()}`;
  const redis = await getRedis();
  if (redis) await redis.set(key, record, { ex: FINGERPRINT_TTL_SECONDS });
  else memValues.set(key, JSON.stringify(record));
}

export async function getFingerprint(
  fp: string
): Promise<FingerprintRecord | null> {
  if (productionGuardTripped()) return null;
  const key = `${KEY_PREFIX}:fp:${fp.toLowerCase()}`;
  const redis = await getRedis();
  if (redis) return await redis.get<FingerprintRecord>(key);
  const raw = memValues.get(key);
  return raw ? (JSON.parse(raw) as FingerprintRecord) : null;
}

/**
 * Index a watermark nonce → fingerprint (`streme:floor:nonce:<nonce>`,
 * 48h TTL). Tier-2 join key: the watcher reads the nonce off chain data and
 * resolves it to the fingerprint record.
 */
export async function putNonceIndex(nonce: string, fp: string): Promise<void> {
  if (productionGuardTripped()) return;
  const key = `${KEY_PREFIX}:nonce:${nonce.toLowerCase()}`;
  const redis = await getRedis();
  if (redis)
    await redis.set(key, fp.toLowerCase(), { ex: FINGERPRINT_TTL_SECONDS });
  else memValues.set(key, fp.toLowerCase());
}

export async function getNonceIndex(nonce: string): Promise<string | null> {
  if (productionGuardTripped()) return null;
  const key = `${KEY_PREFIX}:nonce:${nonce.toLowerCase()}`;
  const redis = await getRedis();
  if (redis) return await redis.get<string>(key);
  return memValues.get(key) ?? null;
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/** Clears the in-memory fallback and resets the production-guard warning. */
export function __clearFloorStoreForTests(): void {
  memLists.clear();
  memValues.clear();
  memCounters.clear();
  warnedMissingRedisInProd = false;
  redisPromise = null;
}
