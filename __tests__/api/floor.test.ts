// Agent Floor snapshot API tests (plan U5) — route GET imported directly,
// store seeded through the in-memory fallback (no Redis env in tests).

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

// Wrap one store read in jest.fn so the degradation test can inject a
// failure; every other call passes through to the real in-memory store.
jest.mock("@/src/lib/floor/store", () => {
  const actual = jest.requireActual(
    "@/src/lib/floor/store"
  ) as typeof import("@/src/lib/floor/store");
  return {
    ...actual,
    getRecentEvents: jest.fn(actual.getRecentEvents),
  };
});

import { GET } from "@/src/app/api/agents/floor/route";
import {
  __clearFloorStoreForTests,
  bumpVerifiedCounters,
  floorDateKey,
  getRecentEvents,
  publishEvents,
  recordToolCall,
  type FloorEvent,
} from "@/src/lib/floor/store";

const TOKEN = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
// First entry of BLACKLISTED_TOKENS in src/lib/blacklist.ts (lowercased)
const BLACKLISTED_TOKEN = "0x1eff3dd78f4a14abfa9fa66579bd3ce9e1b30529";
const WALLET = "0x1111111111111111111111111111111111111111";
const RESIDENT_WALLET = "0x2222222222222222222222222222222222222222";

let txCounter = 0;

function makeEvent(overrides: Partial<FloorEvent> = {}): FloorEvent {
  txCounter += 1;
  return {
    txHash: `0x${txCounter.toString(16).padStart(64, "0")}`,
    block: "1000",
    at: Date.now(),
    kind: "buy",
    wallet: WALLET,
    token: TOKEN,
    amountEth: "0.05",
    tier: 1,
    agentId: "alpha-bot",
    source: "agent",
    description: "Bought 0.05 ETH of a Streme token",
    ...overrides,
  };
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.VERCEL_ENV;
  __clearFloorStoreForTests();
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("GET /api/agents/floor — empty store", () => {
  it("returns 200, cold start, empty events, zeroed counters, cache headers", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=60");
    expect(response.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate"
    );

    const data = await response.json();
    expect(data.coldStart).toBe(true);
    expect(data.events).toEqual([]);
    expect(data.resident).toBeNull();
    expect(data.generatedAt).toBeGreaterThan(0);

    const today = floorDateKey(Date.now());
    expect(data.counters.today).toEqual({
      date: today,
      volumeEthExternal: 0,
      volumeEthResident: 0,
      activeAgentWallets: 0,
      buys: 0,
      stakes: 0,
      unstakes: 0,
      connects: 0,
      streamsOpened: 0,
    });
    expect(data.counters.yesterday.date).toBe(
      floorDateKey(Date.now() - 24 * 3600 * 1000)
    );

    // Tool-call count is explicitly labeled unverified in the payload shape.
    expect(data.secondary).toEqual({ unverifiedToolCallsToday: 0 });
  });
});

describe("GET /api/agents/floor — seeded store", () => {
  it("serves events, resident/external volume split, and the unverified key", async () => {
    await publishEvents([
      makeEvent({ agentId: "alpha-bot", tier: 1 }),
      makeEvent({ kind: "stake", amountEth: undefined, tier: 2 }),
    ]);
    await bumpVerifiedCounters({
      kind: "buy",
      wallet: WALLET,
      volumeEth: 0.05,
    });
    await bumpVerifiedCounters({ kind: "stake", wallet: WALLET });
    await bumpVerifiedCounters({
      kind: "buy",
      wallet: RESIDENT_WALLET,
      volumeEth: 0.01,
      isResident: true,
    });
    await recordToolCall({
      tool: "build_buy_transaction",
      paramsDigest: "0xdigest",
      agentId: "alpha-bot",
      at: Date.now(),
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.coldStart).toBe(false);
    expect(data.events).toHaveLength(2);
    // Newest-first: the stake published last comes back first.
    expect(data.events[0].kind).toBe("stake");
    expect(data.events[1].agentId).toBe("alpha-bot");

    const today = data.counters.today;
    expect(today.volumeEthExternal).toBeCloseTo(0.05);
    expect(today.volumeEthResident).toBeCloseTo(0.01);
    expect(today.buys).toBe(2); // external + resident buys both count by kind
    expect(today.stakes).toBe(1);
    expect(today.activeAgentWallets).toBe(2);

    expect(data.secondary.unverifiedToolCallsToday).toBe(1);
    expect(data.secondary).not.toHaveProperty("toolCallsToday");
  });

  it("serves tier-3 (watermark-only) events — display policy is client-side", async () => {
    await publishEvents([makeEvent({ tier: 3, agentId: null })]);
    const response = await GET();
    const data = await response.json();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].tier).toBe(3);
  });

  it("drops blacklisted-token events at serve time (defense-in-depth, R18)", async () => {
    await publishEvents([
      makeEvent({ token: TOKEN }),
      makeEvent({ token: BLACKLISTED_TOKEN }),
    ]);
    const response = await GET();
    const data = await response.json();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].token).toBe(TOKEN);
  });
});

describe("GET /api/agents/floor — store failure degradation", () => {
  it("returns 200 with a degraded payload when a store helper throws", async () => {
    // Counters still seeded through the real store — only the events read
    // fails, so the payload degrades partially rather than 500ing.
    await bumpVerifiedCounters({
      kind: "buy",
      wallet: WALLET,
      volumeEth: 0.05,
    });
    (getRecentEvents as jest.Mock).mockRejectedValueOnce(
      new Error("redis down") as never
    );

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.events).toEqual([]);
    expect(data.counters.today.volumeEthExternal).toBeCloseTo(0.05);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns 200 with empty payload when a store helper throws synchronously", async () => {
    (getRecentEvents as jest.Mock).mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.events).toEqual([]);
    expect(data.coldStart).toBe(true);
  });
});
