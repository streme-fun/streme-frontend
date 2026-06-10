import { describe, expect, it } from "@jest/globals";
import { rankTokens, scoreToken } from "@/src/lib/pulse/score";
import type { PulseTokenMetrics } from "@/src/lib/pulse/types";

const NOW = 1_780_000_000;

function metrics(overrides: Partial<PulseTokenMetrics> = {}): PulseTokenMetrics {
  return {
    address: "0xabc0000000000000000000000000000000000001",
    name: "Test Token",
    symbol: "TEST",
    img_url: null,
    createdAt: NOW - 30 * 86400,
    lastTradedAt: 0,
    marketCap: 0,
    price: 0,
    volume24h: 0,
    change1h: 0,
    change24h: 0,
    ...overrides,
  };
}

describe("scoreToken", () => {
  it("scores an active token above a dead one", () => {
    const active = scoreToken(
      metrics({
        volume24h: 50_000,
        change24h: 25,
        lastTradedAt: NOW - 600,
        totalStakers: 200,
      }),
      NOW
    );
    const dead = scoreToken(metrics(), NOW);

    expect(active.score).toBeGreaterThan(dead.score);
    expect(dead.score).toBe(0);
  });

  it("boosts fresh launches", () => {
    const fresh = scoreToken(metrics({ createdAt: NOW - 3600 }), NOW);
    const old = scoreToken(metrics({ createdAt: NOW - 30 * 86400 }), NOW);

    expect(fresh.score).toBeGreaterThan(old.score);
    expect(fresh.reasons).toContainEqual(expect.stringContaining("launched"));
  });

  it("keeps scores within 0-100 even with extreme inputs", () => {
    const extreme = scoreToken(
      metrics({
        volume24h: 1e12,
        change24h: 100_000,
        change1h: 100_000,
        createdAt: NOW,
        lastTradedAt: NOW,
        totalStakers: 1_000_000,
      }),
      NOW
    );
    expect(extreme.score).toBeLessThanOrEqual(100);
    expect(extreme.score).toBeGreaterThan(90);

    const crash = scoreToken(
      metrics({ change24h: -99, change1h: -99 }),
      NOW
    );
    expect(crash.score).toBeGreaterThanOrEqual(0);
  });

  it("does not pad reasons with noise for quiet tokens", () => {
    const quiet = scoreToken(
      metrics({ volume24h: 12, change24h: 1.2, totalStakers: 3 }),
      NOW
    );
    expect(quiet.reasons).toEqual([]);
  });

  it("includes legible reasons above the floors", () => {
    const loud = scoreToken(
      metrics({
        volume24h: 12_400,
        change24h: 18,
        totalStakers: 234,
        createdAt: NOW - 6 * 3600,
      }),
      NOW
    );
    expect(loud.reasons).toEqual([
      "$12.4k 24h volume",
      "+18% 24h",
      "launched 6h ago",
      "234 stakers",
    ]);
  });

  it("handles missing/NaN market data safely", () => {
    const broken = scoreToken(
      metrics({ volume24h: NaN, change24h: NaN, marketCap: NaN }),
      NOW
    );
    expect(Number.isFinite(broken.score)).toBe(true);
  });
});

describe("rankTokens", () => {
  it("ranks by score, assigns 1-based ranks, and respects the limit", () => {
    const tokens = [
      metrics({ address: "0x01", symbol: "QUIET" }),
      metrics({
        address: "0x02",
        symbol: "HOT",
        volume24h: 80_000,
        change24h: 40,
        lastTradedAt: NOW - 60,
      }),
      metrics({
        address: "0x03",
        symbol: "WARM",
        volume24h: 5_000,
        lastTradedAt: NOW - 3600,
      }),
    ];

    const ranked = rankTokens(tokens, NOW, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].symbol).toBe("HOT");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].symbol).toBe("WARM");
    expect(ranked[1].rank).toBe(2);
  });
});
