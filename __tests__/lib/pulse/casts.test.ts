import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  buildDailyPulseCast,
  buildMilestoneCast,
  liveCastingEnabled,
  publishCast,
  trimToBytes,
} from "@/src/lib/pulse/casts";
import type {
  Milestone,
  PulseSnapshot,
  PulseToken,
} from "@/src/lib/pulse/types";

const NOW = 1_780_000_000;

function pulseToken(overrides: Partial<PulseToken> = {}): PulseToken {
  return {
    address: "0xabc0000000000000000000000000000000000001",
    name: "Test Token",
    symbol: "TEST",
    img_url: null,
    createdAt: NOW - 86400,
    lastTradedAt: NOW - 600,
    marketCap: 250_000,
    price: 0.0001,
    volume24h: 12_400,
    change1h: 2,
    change24h: 18,
    totalStakers: 234,
    rank: 1,
    score: 80,
    reasons: [],
    ...overrides,
  };
}

function snapshot(tokens: PulseToken[]): PulseSnapshot {
  return {
    generatedAt: NOW,
    tokens,
    totals: {
      trackedTokens: tokens.length,
      activeTokens24h: tokens.length,
      volume24h: tokens.reduce((s, t) => s + t.volume24h, 0),
      marketCap: tokens.reduce((s, t) => s + t.marketCap, 0),
      launches7d: 0,
    },
  };
}

const milestone: Milestone = {
  id: "market_cap:0xabc0000000000000000000000000000000000001:1000000",
  type: "market_cap",
  tokenAddress: "0xabc0000000000000000000000000000000000001",
  symbol: "TEST",
  name: "Test Token",
  threshold: 1_000_000,
  value: 1_150_000,
  detectedAt: NOW,
};

const PULSE_ENV_KEYS = [
  "PULSE_CASTS_ENABLED",
  "NEYNAR_API_KEY",
  "STREME_SIGNER_UUID",
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of PULSE_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  // jest.setup.js installs global.fetch as a shared jest.fn; clear its
  // accumulated call history so per-test spies start clean.
  (global.fetch as jest.Mock).mockReset();
});

function mockFetchResponse(status: number, body: unknown) {
  return jest.spyOn(global, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response);
}

afterEach(() => {
  for (const key of PULSE_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  jest.restoreAllMocks();
});

describe("buildDailyPulseCast", () => {
  it("includes top tokens with stats and stays within the cast limit", () => {
    const draft = buildDailyPulseCast(
      snapshot([
        pulseToken({ symbol: "AAA", volume24h: 50_000 }),
        pulseToken({ address: "0x02", symbol: "BBB", volume24h: 20_000 }),
        pulseToken({ address: "0x03", symbol: "CCC", volume24h: 10_000 }),
        pulseToken({ address: "0x04", symbol: "DDD", volume24h: 5_000 }),
      ]),
      "2026-06-10"
    );

    expect(draft).not.toBeNull();
    expect(draft!.text).toContain("$AAA");
    expect(draft!.text).toContain("$BBB");
    expect(draft!.text).toContain("$CCC");
    expect(draft!.text).not.toContain("$DDD"); // top 3 only
    expect(draft!.idem).toBe("daily_pulse:2026-06-10");
    expect(draft!.embedUrl).toContain("/pulse");
    expect(new TextEncoder().encode(draft!.text).length).toBeLessThanOrEqual(
      1024
    );
  });

  it("returns null when activity is below the quality gate", () => {
    const draft = buildDailyPulseCast(
      snapshot([pulseToken({ volume24h: 40 })]),
      "2026-06-10"
    );
    expect(draft).toBeNull();
  });
});

describe("buildMilestoneCast", () => {
  it("celebrates the crossing and embeds the token page", () => {
    const draft = buildMilestoneCast(milestone);
    expect(draft.text).toContain("$TEST");
    expect(draft.text).toContain("$1M");
    expect(draft.idem).toBe(milestone.id);
    expect(draft.embedUrl).toContain(`/token/${milestone.tokenAddress}`);
  });

  it("@mentions the creator when their username is known", () => {
    const draft = buildMilestoneCast({
      ...milestone,
      creatorUsername: "alice",
    });
    expect(draft.text).toContain("$TEST by @alice just crossed");
  });

  it("omits the byline when the creator is unknown", () => {
    const draft = buildMilestoneCast(milestone);
    expect(draft.text).not.toContain(" by @");
  });
});

describe("publishCast", () => {
  it("dry-runs without network calls when live casting is disabled", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const record = await publishCast(buildMilestoneCast(milestone), {
      now: NOW,
    });

    expect(liveCastingEnabled()).toBe(false);
    expect(record.status).toBe("dry_run");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("publishes via Neynar when fully configured", async () => {
    process.env.PULSE_CASTS_ENABLED = "true";
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.STREME_SIGNER_UUID = "test-signer";

    const fetchSpy = mockFetchResponse(200, { cast: { hash: "0xcast" } });

    const record = await publishCast(buildMilestoneCast(milestone), {
      now: NOW,
    });

    expect(record.status).toBe("published");
    expect(record.castHash).toBe("0xcast");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.neynar.com/v2/farcaster/cast",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.signer_uuid).toBe("test-signer");
    expect(body.embeds).toEqual([
      { url: expect.stringContaining("/token/") },
    ]);
  });

  it("records a failure instead of throwing on API errors", async () => {
    process.env.PULSE_CASTS_ENABLED = "true";
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.STREME_SIGNER_UUID = "test-signer";

    mockFetchResponse(429, "rate limited");

    const record = await publishCast(buildMilestoneCast(milestone), {
      now: NOW,
    });
    expect(record.status).toBe("failed");
    expect(record.error).toContain("429");
  });

  it("honors forceDryRun even when fully configured", async () => {
    process.env.PULSE_CASTS_ENABLED = "true";
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.STREME_SIGNER_UUID = "test-signer";

    const fetchSpy = jest.spyOn(global, "fetch");
    const record = await publishCast(buildMilestoneCast(milestone), {
      now: NOW,
      forceDryRun: true,
    });

    expect(record.status).toBe("dry_run");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("trimToBytes", () => {
  it("leaves short text untouched", () => {
    expect(trimToBytes("hello", 1024)).toBe("hello");
  });

  it("trims long text to the byte budget with an ellipsis", () => {
    const long = "a".repeat(2000);
    const trimmed = trimToBytes(long, 100);
    expect(new TextEncoder().encode(trimmed).length).toBeLessThanOrEqual(100);
    expect(trimmed.endsWith("…")).toBe(true);
  });

  it("does not split multi-byte characters", () => {
    const emoji = "🌊".repeat(100);
    const trimmed = trimToBytes(emoji, 50);
    expect(new TextEncoder().encode(trimmed).length).toBeLessThanOrEqual(50);
    // Decoding round-trip proves we didn't cut a codepoint in half
    expect(trimmed).toBe(
      new TextDecoder().decode(new TextEncoder().encode(trimmed))
    );
  });
});
