import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import {
  aiCopyEnabled,
  extractProtectedTokens,
  polishCastDraft,
  validateRewrite,
} from "@/src/lib/pulse/ai";
import type { CastDraft } from "@/src/lib/pulse/types";

const ENV_KEYS = ["PULSE_AI_COPY", "ANTHROPIC_API_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("extractProtectedTokens", () => {
  it("finds tickers, dollar figures, percents, and mentions", () => {
    const tokens = extractProtectedTokens(
      "🌊 $TEST by @alice just crossed $1M market cap, +18% today on $12.4k volume"
    );
    expect(tokens).toEqual(
      expect.arrayContaining(["$TEST", "@alice", "$1M", "+18%", "$12.4k"])
    );
  });
});

describe("validateRewrite", () => {
  const original = "$TEST by @alice crossed $1M market cap · +18% 24h";

  it("accepts a rewrite that preserves every protected token", () => {
    expect(
      validateRewrite(
        original,
        "the stream got bigger: $TEST (h/t @alice) just hit $1M market cap, up +18% today"
      )
    ).toBe(true);
  });

  it("rejects a rewrite that drops or alters a number", () => {
    expect(
      validateRewrite(original, "$TEST by @alice crossed $2M market cap")
    ).toBe(false);
    expect(validateRewrite(original, "")).toBe(false);
  });

  it("rejects oversized rewrites", () => {
    expect(validateRewrite(original, original + "x".repeat(2000))).toBe(false);
  });
});

describe("polishCastDraft", () => {
  const draft: CastDraft = {
    kind: "milestone",
    idem: "test",
    text: "$TEST crossed $1M market cap",
    embedUrl: "https://streme.fun/token/0xabc",
  };

  it("is disabled by default and returns the draft untouched", async () => {
    expect(aiCopyEnabled()).toBe(false);
    const result = await polishCastDraft(draft);
    expect(result).toBe(draft);
  });

  it("requires both the flag and an API key", () => {
    process.env.PULSE_AI_COPY = "true";
    expect(aiCopyEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(aiCopyEnabled()).toBe(true);
  });
});
