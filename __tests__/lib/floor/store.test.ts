import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import {
  __clearFloorStoreForTests,
  floorDateKey,
  getDailyCallCount,
  getFingerprint,
  getNonceIndex,
  getRecentTelemetry,
  putFingerprint,
  putNonceIndex,
  recordToolCall,
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
