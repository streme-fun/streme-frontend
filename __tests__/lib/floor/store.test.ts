import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

// Fake Upstash client for the redis-path getVerifiedCounters test — only
// the commands that path uses. The store's dynamic import("@upstash/redis")
// resolves to this mock once the env vars are set.
const mockRedis = {
  mget: jest.fn(),
  scard: jest.fn(),
};

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn(() => mockRedis),
}));

import {
  __clearFloorStoreForTests,
  bumpVerifiedCounters,
  consumeNonceIndex,
  floorDateKey,
  getDailyCallCount,
  getFingerprint,
  getNonceIndex,
  getRecentTelemetry,
  getVerifiedCounters,
  markSeenIfNew,
  putFingerprint,
  putNonceIndex,
  recordToolCall,
  wasSeen,
  type FloorTelemetryEntry,
} from "@/src/lib/floor/store";

const NOW = Date.now();

function entry(
  overrides: Partial<FloorTelemetryEntry> = {}
): FloorTelemetryEntry {
  return {
    tool: "list_streme_tokens",
    paramsDigest: "0xdigest",
    agentId: null,
    at: NOW,
    ...overrides,
  };
}

// The store reads env per call, so clearing here is enough to force the
// in-memory path even if a .env file ever appears.
beforeEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.VERCEL_ENV;
  __clearFloorStoreForTests();
});

describe("floor store telemetry list (in-memory mode)", () => {
  it("appends entries newest-first and caps the list at 500", async () => {
    for (let i = 0; i < 505; i++) {
      await recordToolCall(entry({ paramsDigest: `0x${i}` }));
    }
    const recent = await getRecentTelemetry(1000);
    expect(recent).toHaveLength(500);
    expect(recent[0].paramsDigest).toBe("0x504"); // newest first
    expect(recent[499].paramsDigest).toBe("0x5"); // oldest 5 trimmed away
  });

  it("respects the read limit", async () => {
    await recordToolCall(entry({ paramsDigest: "0xa" }));
    await recordToolCall(entry({ paramsDigest: "0xb" }));
    const recent = await getRecentTelemetry(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].paramsDigest).toBe("0xb");
  });
});

describe("floor store daily counters", () => {
  it("increments the TTL-keyed counter per call, keyed by UTC date", async () => {
    await recordToolCall(entry());
    await recordToolCall(entry());
    expect(await getDailyCallCount(floorDateKey(NOW))).toBe(2);
    expect(await getDailyCallCount("1999-01-01")).toBe(0);
  });

  it("keys counters by the entry's own timestamp", async () => {
    const yesterday = NOW - 24 * 3600 * 1000;
    await recordToolCall(entry({ at: yesterday }));
    expect(await getDailyCallCount(floorDateKey(yesterday))).toBe(1);
  });
});

describe("floor store fingerprints and nonce index", () => {
  it("round-trips a fingerprint record", async () => {
    const record = {
      tool: "build_stake_transaction",
      agentId: "test-agent",
      builtAt: NOW,
      nonce: "0xdeadbeef",
    };
    await putFingerprint("0xABCD1234", record);
    // Keys are normalized to lowercase
    expect(await getFingerprint("0xabcd1234")).toEqual(record);
    expect(await getFingerprint("0xffff0000")).toBeNull();
  });

  it("round-trips the nonce → fingerprint index", async () => {
    await putNonceIndex("0xDEADBEEF", "0xABCD1234");
    expect(await getNonceIndex("0xdeadbeef")).toBe("0xabcd1234");
    expect(await getNonceIndex("0x00000000")).toBeNull();
  });

  it("consumeNonceIndex deletes the entry — a consumed nonce never resolves again", async () => {
    await putNonceIndex("0xDEADBEEF", "0xABCD1234");
    await consumeNonceIndex("0xdeadbeef");
    expect(await getNonceIndex("0xdeadbeef")).toBeNull();
    // Consuming an absent nonce is a no-op, not an error.
    await expect(consumeNonceIndex("0xdeadbeef")).resolves.toBeUndefined();
  });
});

describe("floor store seen barrier", () => {
  it("markSeenIfNew returns true exactly once per key", async () => {
    expect(await markSeenIfNew("0xAAA")).toBe(true);
    expect(await markSeenIfNew("0xaaa")).toBe(false); // case-insensitive key
    expect(await markSeenIfNew("0xbbb")).toBe(true);
    expect(await wasSeen("0xaaa")).toBe(true);
    expect(await wasSeen("0xccc")).toBe(false);
  });
});

describe("floor store getVerifiedCounters", () => {
  const date = "2026-06-11";

  it("aggregates in-memory counters into the snapshot", async () => {
    await bumpVerifiedCounters({ kind: "buy", wallet: "0xA", volumeEth: 0.5, date });
    await bumpVerifiedCounters({ kind: "stake", wallet: "0xB", date });
    await bumpVerifiedCounters({
      kind: "buy",
      wallet: "0xA",
      volumeEth: 0.25,
      isResident: true,
      date,
    });

    const snapshot = await getVerifiedCounters(date);
    expect(snapshot.byKind).toEqual({
      buy: 2,
      stake: 1,
      unstake: 0,
      stream: 0,
      connect: 0,
    });
    expect(snapshot.volumeEth).toBe(0.5);
    expect(snapshot.residentVolumeEth).toBe(0.25);
    expect(snapshot.activeWallets).toBe(2);
  });

  it("redis path reads all counters with ONE mget, mapping values by key order", async () => {
    process.env.KV_REST_API_URL = "https://fake.upstash.example";
    process.env.KV_REST_API_TOKEN = "token";
    __clearFloorStoreForTests(); // reset the cached client promise

    const prefix = "streme:floor";
    // Distinct value per key — any key-order mix-up misassigns a field.
    const data = new Map<string, number>([
      [`${prefix}:counters:verified:buy:${date}`, 1],
      [`${prefix}:counters:verified:stake:${date}`, 2],
      [`${prefix}:counters:verified:unstake:${date}`, 3],
      [`${prefix}:counters:verified:stream:${date}`, 4],
      [`${prefix}:counters:verified:connect:${date}`, 5],
      [`${prefix}:counters:volume:${date}`, 0.5],
      [`${prefix}:counters:volume:resident:${date}`, 0.25],
    ]);
    mockRedis.mget.mockImplementation(async (...keys: string[]) =>
      keys.map((key) => data.get(key) ?? null)
    );
    mockRedis.scard.mockResolvedValue(7);

    try {
      const snapshot = await getVerifiedCounters(date);

      expect(mockRedis.mget).toHaveBeenCalledTimes(1);
      expect(mockRedis.mget).toHaveBeenCalledWith(
        `${prefix}:counters:verified:buy:${date}`,
        `${prefix}:counters:verified:stake:${date}`,
        `${prefix}:counters:verified:unstake:${date}`,
        `${prefix}:counters:verified:stream:${date}`,
        `${prefix}:counters:verified:connect:${date}`,
        `${prefix}:counters:volume:${date}`,
        `${prefix}:counters:volume:resident:${date}`
      );
      expect(mockRedis.scard).toHaveBeenCalledWith(
        `${prefix}:wallets:${date}`
      );
      expect(snapshot.byKind).toEqual({
        buy: 1,
        stake: 2,
        unstake: 3,
        stream: 4,
        connect: 5,
      });
      expect(snapshot.volumeEth).toBe(0.5);
      expect(snapshot.residentVolumeEth).toBe(0.25);
      expect(snapshot.activeWallets).toBe(7);
    } finally {
      delete process.env.KV_REST_API_URL;
      delete process.env.KV_REST_API_TOKEN;
      __clearFloorStoreForTests();
      mockRedis.mget.mockReset();
      mockRedis.scard.mockReset();
    }
  });
});

describe("floor store production guard (plan R22)", () => {
  afterEach(() => {
    delete process.env.VERCEL_ENV;
    jest.restoreAllMocks();
  });

  it("no-ops every read/write and logs console.error exactly once", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    process.env.VERCEL_ENV = "production";

    await recordToolCall(entry());
    await putFingerprint("0xdead", {
      tool: "build_stake_transaction",
      agentId: null,
      builtAt: NOW,
      nonce: null,
    });
    await putNonceIndex("0xdeadbeef", "0xdead");

    // One prominent error per process — not one per call
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("production");

    // Reads no-op too, without further error spam
    expect(await getRecentTelemetry(10)).toEqual([]);
    expect(await getDailyCallCount(floorDateKey(NOW))).toBe(0);
    expect(await getFingerprint("0xdead")).toBeNull();
    expect(await getNonceIndex("0xdeadbeef")).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // Nothing leaked into the in-memory fallback while guarded
    delete process.env.VERCEL_ENV;
    expect(await getRecentTelemetry(10)).toEqual([]);
    expect(await getFingerprint("0xdead")).toBeNull();
  });
});
