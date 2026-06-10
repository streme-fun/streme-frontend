import { describe, expect, it } from "@jest/globals";
import {
  detectMarketCapMilestones,
  highestCrossedThreshold,
  seedAnnouncedState,
} from "@/src/lib/pulse/milestones";
import type { PulseTokenMetrics } from "@/src/lib/pulse/types";

const NOW = 1_780_000_000;

function metrics(
  overrides: Partial<PulseTokenMetrics> = {}
): PulseTokenMetrics {
  return {
    address: "0xabc0000000000000000000000000000000000001",
    name: "Test Token",
    symbol: "TEST",
    img_url: null,
    createdAt: NOW - 86400,
    lastTradedAt: NOW - 3600,
    marketCap: 0,
    price: 0,
    volume24h: 1000,
    change1h: 0,
    change24h: 0,
    ...overrides,
  };
}

describe("highestCrossedThreshold", () => {
  it("returns 0 below the lowest threshold", () => {
    expect(highestCrossedThreshold(49_999)).toBe(0);
  });

  it("returns the highest crossed level", () => {
    expect(highestCrossedThreshold(50_000)).toBe(50_000);
    expect(highestCrossedThreshold(999_999)).toBe(500_000);
    expect(highestCrossedThreshold(123_000_000)).toBe(100_000_000);
  });
});

describe("detectMarketCapMilestones", () => {
  it("detects a first crossing", () => {
    const found = detectMarketCapMilestones(
      [metrics({ marketCap: 120_000 })],
      {},
      NOW
    );
    expect(found).toHaveLength(1);
    expect(found[0].threshold).toBe(100_000);
    expect(found[0].id).toBe(
      "market_cap:0xabc0000000000000000000000000000000000001:100000"
    );
  });

  it("does not re-announce a level that was already announced", () => {
    const announced = {
      "0xabc0000000000000000000000000000000000001": 100_000,
    };
    const found = detectMarketCapMilestones(
      [metrics({ marketCap: 120_000 })],
      announced,
      NOW
    );
    expect(found).toHaveLength(0);
  });

  it("announces only the highest newly crossed level per token", () => {
    const announced = {
      "0xabc0000000000000000000000000000000000001": 50_000,
    };
    const found = detectMarketCapMilestones(
      [metrics({ marketCap: 600_000 })],
      announced,
      NOW
    );
    expect(found).toHaveLength(1);
    expect(found[0].threshold).toBe(500_000);
  });

  it("ignores crossings on tokens that have not traded recently", () => {
    const found = detectMarketCapMilestones(
      [metrics({ marketCap: 120_000, lastTradedAt: NOW - 3 * 86400 })],
      {},
      NOW
    );
    expect(found).toHaveLength(0);
  });

  it("sorts multiple milestones by threshold descending", () => {
    const found = detectMarketCapMilestones(
      [
        metrics({ address: "0x01", symbol: "SMALL", marketCap: 60_000 }),
        metrics({ address: "0x02", symbol: "BIG", marketCap: 2_000_000 }),
      ],
      {},
      NOW
    );
    expect(found.map((m) => m.symbol)).toEqual(["BIG", "SMALL"]);
  });
});

describe("seedAnnouncedState", () => {
  it("records current levels without emitting milestones", () => {
    const seeded = seedAnnouncedState([
      metrics({ address: "0x01", marketCap: 120_000 }),
      metrics({ address: "0x02", marketCap: 10 }),
    ]);
    expect(seeded).toEqual({ "0x01": 100_000 });
  });
});
