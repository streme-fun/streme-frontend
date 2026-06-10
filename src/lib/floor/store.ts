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
// Watcher state (U4): block cursor, run lock, published events, the
// seen-tx dedupe set, and chain-verified daily counters.
//
// Resident state (U7): decision journal (capped list), halt flag, daily
// ETH spend ledger, and the isRedisLive() probe the Resident's fail-closed
// gate requires — the in-memory fallback never counts as "live" (plan R22).

import type { Redis } from "@upstash/redis";

const KEY_PREFIX = "streme:floor";
const TELEMETRY_KEY = `${KEY_PREFIX}:telemetry`;
const TELEMETRY_CAP = 500;
/** Fingerprints live 48h — agents may sign long after building. */
const FINGERPRINT_TTL_SECONDS = 48 * 3600;
const DAILY_COUNTER_TTL_SECONDS = 3 * 86400;
const CURSOR_KEY = `${KEY_PREFIX}:cursor`;
const EVENTS_KEY = `${KEY_PREFIX}:events`;
const EVENTS_CAP = 200;
/** Seen-tx dedupe entries outlive any plausible reorg/replay window. */
const SEEN_TTL_SECONDS = 7 * 86400;

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

/** Verified on-chain event kinds the watcher publishes. */
export type FloorEventKind =
  | "buy"
  | "stake"
  | "stake_refunded"
  | "unstake"
  | "stream"
  | "connect";

/** A chain-verified Floor event, as published to the feed. */
export interface FloorEvent {
  txHash: string;
  /** Block number as a decimal string (bigint-safe for JSON) */
  block: string;
  /** Block timestamp, epoch ms */
  at: number;
  kind: FloorEventKind;
  wallet: string;
  token?: string;
  amountEth?: string;
  amountToken?: string;
  /** 1 = fingerprint, 2 = watermark+telemetry, 3 = watermark-only */
  tier: 1 | 2 | 3;
  /** Self-declared agentId from the fingerprint record (tier 1/2 only) */
  agentId?: string | null;
  source: "agent" | "floor-ui";
  staked?: boolean;
  belowFloor?: boolean;
  description: string;
}

/** Kinds that count toward verified headline counters (refunds never do). */
export const COUNTABLE_KINDS = [
  "buy",
  "stake",
  "unstake",
  "stream",
  "connect",
] as const;
export type CountableKind = (typeof COUNTABLE_KINDS)[number];

export interface VerifiedCountersSnapshot {
  date: string;
  byKind: Record<CountableKind, number>;
  /**
   * Keys are named "volume" for forward-compat, but v1 stores ETH numbers
   * (buy amountEth sums) — USD pricing is a display-time concern.
   */
  volumeEth: number;
  residentVolumeEth: number;
  activeWallets: number;
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
// out of prod). TTLs are ignored here, same as the pulse store — except
// locks, where expiry is the whole point, so those track an expiresAt.
const memLists = new Map<string, string[]>();
const memValues = new Map<string, string>();
const memCounters = new Map<string, number>();
const memSets = new Map<string, Set<string>>();
const memLocks = new Map<string, number>(); // key → expiresAt epoch ms

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
// Watcher cursor + lock
// ---------------------------------------------------------------------------

/** Last fully-processed block number (decimal string), or null on first run. */
export async function getCursor(): Promise<string | null> {
  if (productionGuardTripped()) return null;
  const redis = await getRedis();
  if (redis) {
    const value = await redis.get<string | number>(CURSOR_KEY);
    return value === null || value === undefined ? null : String(value);
  }
  return memValues.get(CURSOR_KEY) ?? null;
}

export async function setCursor(block: string): Promise<void> {
  if (productionGuardTripped()) return;
  const redis = await getRedis();
  if (redis) await redis.set(CURSOR_KEY, block);
  else memValues.set(CURSOR_KEY, block);
}

/**
 * Set-if-absent lock (`streme:floor:lock:<name>`) with a TTL so a crashed
 * run can never wedge the watcher. Returns true when acquired.
 */
export async function acquireLock(
  name: string,
  ttlSeconds: number
): Promise<boolean> {
  if (productionGuardTripped()) return false;
  const key = `${KEY_PREFIX}:lock:${name}`;
  const redis = await getRedis();
  if (redis) {
    const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
    return result === "OK";
  }
  const expiresAt = memLocks.get(key);
  if (expiresAt !== undefined && expiresAt > Date.now()) return false;
  memLocks.set(key, Date.now() + ttlSeconds * 1000);
  return true;
}

export async function releaseLock(name: string): Promise<void> {
  if (productionGuardTripped()) return;
  const key = `${KEY_PREFIX}:lock:${name}`;
  const redis = await getRedis();
  if (redis) await redis.del(key);
  else memLocks.delete(key);
}

// ---------------------------------------------------------------------------
// Published events + seen-tx dedupe
// ---------------------------------------------------------------------------

/** Publish verified events to the feed list (newest first, capped at 200). */
export async function publishEvents(events: FloorEvent[]): Promise<void> {
  if (productionGuardTripped() || events.length === 0) return;
  const serialized = events.map((event) => JSON.stringify(event));
  const redis = await getRedis();
  if (redis) {
    await redis.lpush(EVENTS_KEY, ...serialized);
    await redis.ltrim(EVENTS_KEY, 0, EVENTS_CAP - 1);
  } else {
    const list = memLists.get(EVENTS_KEY) ?? [];
    list.unshift(...serialized.slice().reverse());
    if (list.length > EVENTS_CAP) list.length = EVENTS_CAP;
    memLists.set(EVENTS_KEY, list);
  }
}

function parseFloorEvent(raw: unknown): FloorEvent | null {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      value &&
      typeof value === "object" &&
      typeof (value as FloorEvent).txHash === "string" &&
      typeof (value as FloorEvent).kind === "string"
    ) {
      return value as FloorEvent;
    }
  } catch {
    // Malformed entry — drop it rather than failing the whole read.
  }
  return null;
}

/** Most recent published events, newest first. */
export async function getRecentEvents(limit = 50): Promise<FloorEvent[]> {
  if (productionGuardTripped()) return [];
  const redis = await getRedis();
  const raw = redis
    ? await redis.lrange(EVENTS_KEY, 0, limit - 1)
    : (memLists.get(EVENTS_KEY) ?? []).slice(0, limit);
  return raw
    .map(parseFloorEvent)
    .filter((event): event is FloorEvent => event !== null);
}

/**
 * Dedupe set for processed transactions. `key` is `<txHash>` (one event per
 * tx in v1) or `<txHash>:<logIndex>` if multi-action txs ever need it.
 */
export async function wasSeen(key: string): Promise<boolean> {
  if (productionGuardTripped()) return false;
  const fullKey = `${KEY_PREFIX}:seen:${key.toLowerCase()}`;
  const redis = await getRedis();
  if (redis) return (await redis.get(fullKey)) !== null;
  return memValues.has(fullKey);
}

export async function markSeen(key: string): Promise<void> {
  if (productionGuardTripped()) return;
  const fullKey = `${KEY_PREFIX}:seen:${key.toLowerCase()}`;
  const redis = await getRedis();
  if (redis) await redis.set(fullKey, "1", { ex: SEEN_TTL_SECONDS });
  else memValues.set(fullKey, "1");
}

// ---------------------------------------------------------------------------
// Verified daily counters
// ---------------------------------------------------------------------------

/**
 * Bump the chain-verified daily counters for one event. `volumeEth` is named
 * after the "volume" keys but stores ETH numbers in v1 (no USD pricing in
 * the watcher — the page can price-display later). Resident events bump the
 * resident volume key, never the external one.
 */
export async function bumpVerifiedCounters(input: {
  kind: CountableKind;
  wallet: string;
  /** ETH volume to add (buys only in v1) */
  volumeEth?: number;
  isResident?: boolean;
  /** UTC date key; defaults to today */
  date?: string;
}): Promise<void> {
  if (productionGuardTripped()) return;
  const date = input.date ?? floorDateKey(Date.now());
  const kindKey = `${KEY_PREFIX}:counters:verified:${input.kind}:${date}`;
  const volumeKey = input.isResident
    ? `${KEY_PREFIX}:counters:volume:resident:${date}`
    : `${KEY_PREFIX}:counters:volume:${date}`;
  const walletsKey = `${KEY_PREFIX}:wallets:${date}`;
  const wallet = input.wallet.toLowerCase();

  const redis = await getRedis();
  if (redis) {
    await redis.incr(kindKey);
    await redis.expire(kindKey, DAILY_COUNTER_TTL_SECONDS);
    if (input.volumeEth) {
      await redis.incrbyfloat(volumeKey, input.volumeEth);
      await redis.expire(volumeKey, DAILY_COUNTER_TTL_SECONDS);
    }
    await redis.sadd(walletsKey, wallet);
    await redis.expire(walletsKey, DAILY_COUNTER_TTL_SECONDS);
  } else {
    memCounters.set(kindKey, (memCounters.get(kindKey) ?? 0) + 1);
    if (input.volumeEth) {
      memCounters.set(volumeKey, (memCounters.get(volumeKey) ?? 0) + input.volumeEth);
    }
    const wallets = memSets.get(walletsKey) ?? new Set<string>();
    wallets.add(wallet);
    memSets.set(walletsKey, wallets);
  }
}

/** Snapshot of the chain-verified counters for one UTC date. */
export async function getVerifiedCounters(
  date: string
): Promise<VerifiedCountersSnapshot> {
  const byKind = Object.fromEntries(
    COUNTABLE_KINDS.map((kind) => [kind, 0])
  ) as Record<CountableKind, number>;
  const snapshot: VerifiedCountersSnapshot = {
    date,
    byKind,
    volumeEth: 0,
    residentVolumeEth: 0,
    activeWallets: 0,
  };
  if (productionGuardTripped()) return snapshot;

  const volumeKey = `${KEY_PREFIX}:counters:volume:${date}`;
  const residentVolumeKey = `${KEY_PREFIX}:counters:volume:resident:${date}`;
  const walletsKey = `${KEY_PREFIX}:wallets:${date}`;

  const redis = await getRedis();
  if (redis) {
    for (const kind of COUNTABLE_KINDS) {
      const value = await redis.get<number>(
        `${KEY_PREFIX}:counters:verified:${kind}:${date}`
      );
      byKind[kind] = value ?? 0;
    }
    snapshot.volumeEth = parseFloat(String((await redis.get(volumeKey)) ?? 0));
    snapshot.residentVolumeEth = parseFloat(
      String((await redis.get(residentVolumeKey)) ?? 0)
    );
    snapshot.activeWallets = await redis.scard(walletsKey);
  } else {
    for (const kind of COUNTABLE_KINDS) {
      byKind[kind] =
        memCounters.get(`${KEY_PREFIX}:counters:verified:${kind}:${date}`) ?? 0;
    }
    snapshot.volumeEth = memCounters.get(volumeKey) ?? 0;
    snapshot.residentVolumeEth = memCounters.get(residentVolumeKey) ?? 0;
    snapshot.activeWallets = memSets.get(walletsKey)?.size ?? 0;
  }
  return snapshot;
}

/**
 * Bump and return a wallet's daily event count
 * (`streme:floor:walletevents:<wallet>:<date>`) — the watcher's per-wallet
 * counter-eligibility cap.
 */
export async function incrWalletDailyEvents(
  wallet: string,
  date: string
): Promise<number> {
  if (productionGuardTripped()) return 0;
  const key = `${KEY_PREFIX}:walletevents:${wallet.toLowerCase()}:${date}`;
  const redis = await getRedis();
  if (redis) {
    const count = await redis.incr(key);
    await redis.expire(key, DAILY_COUNTER_TTL_SECONDS);
    return count;
  }
  const count = (memCounters.get(key) ?? 0) + 1;
  memCounters.set(key, count);
  return count;
}

// ---------------------------------------------------------------------------
// Resident state (U7): journal list, halt flag, spend ledger, liveness probe
// ---------------------------------------------------------------------------

const RESIDENT_JOURNAL_KEY = `${KEY_PREFIX}:resident:journal`;
/** Journal entries kept (newest first). */
export const RESIDENT_JOURNAL_CAP = 200;
const RESIDENT_HALT_KEY = `${KEY_PREFIX}:resident:halt`;
/** Spend ledger entries outlive the day they bound by a comfortable margin. */
const RESIDENT_SPEND_TTL_SECONDS = 3 * 86400;

/**
 * Push a serialized journal entry (newest first, capped). Unlike telemetry,
 * journal writes are NOT fire-and-forget: a Redis failure propagates so the
 * engine can abort before broadcasting (journal-before-broadcast guarantee).
 */
export async function residentJournalPush(serialized: string): Promise<void> {
  if (productionGuardTripped()) return;
  const redis = await getRedis();
  if (redis) {
    await redis.lpush(RESIDENT_JOURNAL_KEY, serialized);
    await redis.ltrim(RESIDENT_JOURNAL_KEY, 0, RESIDENT_JOURNAL_CAP - 1);
  } else {
    const list = memLists.get(RESIDENT_JOURNAL_KEY) ?? [];
    list.unshift(serialized);
    if (list.length > RESIDENT_JOURNAL_CAP) list.length = RESIDENT_JOURNAL_CAP;
    memLists.set(RESIDENT_JOURNAL_KEY, list);
  }
}

/**
 * Raw journal entries, newest first. Items may be strings or (Upstash
 * auto-deserialized) objects — callers parse tolerantly. Indexes align with
 * `residentJournalSet`.
 */
export async function residentJournalList(limit: number): Promise<unknown[]> {
  if (productionGuardTripped()) return [];
  const redis = await getRedis();
  if (redis) return await redis.lrange(RESIDENT_JOURNAL_KEY, 0, limit - 1);
  return (memLists.get(RESIDENT_JOURNAL_KEY) ?? []).slice(0, limit);
}

/**
 * Overwrite one journal entry by list index (LSET). Read-modify-write is
 * acceptable here: the Resident is the journal's single writer, and it only
 * runs under the "resident" lock.
 */
export async function residentJournalSet(
  index: number,
  serialized: string
): Promise<void> {
  if (productionGuardTripped()) return;
  const redis = await getRedis();
  if (redis) {
    await redis.lset(RESIDENT_JOURNAL_KEY, index, serialized);
  } else {
    const list = memLists.get(RESIDENT_JOURNAL_KEY) ?? [];
    if (index >= 0 && index < list.length) list[index] = serialized;
  }
}

/** Kill-switch flag — set/cleared by the authed admin endpoint. No TTL. */
export async function getResidentHalt(): Promise<boolean> {
  if (productionGuardTripped()) return false;
  const redis = await getRedis();
  if (redis) return (await redis.get(RESIDENT_HALT_KEY)) !== null;
  return memValues.has(RESIDENT_HALT_KEY);
}

export async function setResidentHalt(halted: boolean): Promise<void> {
  if (productionGuardTripped()) return;
  const redis = await getRedis();
  if (redis) {
    if (halted) await redis.set(RESIDENT_HALT_KEY, "1");
    else await redis.del(RESIDENT_HALT_KEY);
  } else {
    if (halted) memValues.set(RESIDENT_HALT_KEY, "1");
    else memValues.delete(RESIDENT_HALT_KEY);
  }
}

/** ETH the Resident has committed on a UTC date ("YYYY-MM-DD"). */
export async function getResidentSpend(date: string): Promise<number> {
  if (productionGuardTripped()) return 0;
  const key = `${KEY_PREFIX}:resident:spend:${date}`;
  const redis = await getRedis();
  if (redis) return parseFloat(String((await redis.get(key)) ?? 0));
  return memCounters.get(key) ?? 0;
}

/**
 * Add to (or, with a negative amount, refund from) the day's spend ledger.
 * The engine counts spend pessimistically at broadcast time. Returns the new
 * total.
 */
export async function addResidentSpend(
  date: string,
  amountEth: number
): Promise<number> {
  if (productionGuardTripped()) return 0;
  const key = `${KEY_PREFIX}:resident:spend:${date}`;
  const redis = await getRedis();
  if (redis) {
    const total = parseFloat(String(await redis.incrbyfloat(key, amountEth)));
    await redis.expire(key, RESIDENT_SPEND_TTL_SECONDS);
    return total;
  }
  const total = (memCounters.get(key) ?? 0) + amountEth;
  memCounters.set(key, total);
  return total;
}

// Test seam for the Resident's Redis-liveness gate: the in-memory fallback
// must never count as "live" (plan R22), so tests opt in explicitly instead
// of the gate silently accepting memory.
let redisLiveOverride: boolean | null = null;

/** Force isRedisLive() for tests (null restores real probing). */
export function __setRedisLiveForTests(value: boolean | null): void {
  redisLiveOverride = value;
}

/**
 * True only when a real Redis round-trip (write + read of a probe key)
 * succeeds. The in-memory fallback does NOT count — the Resident fails
 * closed to dry-run without live persistence (plan R22).
 */
export async function isRedisLive(): Promise<boolean> {
  if (redisLiveOverride !== null) return redisLiveOverride;
  if (!redisEnv()) return false;
  try {
    const redis = await getRedis();
    if (!redis) return false;
    const key = `${KEY_PREFIX}:probe`;
    const value = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await redis.set(key, value, { ex: 60 });
    return (await redis.get<string>(key)) === value;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/** Clears the in-memory fallback and resets the production-guard warning. */
export function __clearFloorStoreForTests(): void {
  memLists.clear();
  memValues.clear();
  memCounters.clear();
  memSets.clear();
  memLocks.clear();
  warnedMissingRedisInProd = false;
  redisPromise = null;
  redisLiveOverride = null;
}
