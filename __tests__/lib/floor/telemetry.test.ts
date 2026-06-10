import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

// Wrap the store's write helpers in jest.fn so individual tests can inject
// failures; every other call passes through to the real (in-memory) store.
// Uses the global `jest` so SWC hoists this above the module imports.
jest.mock("@/src/lib/floor/store", () => {
  const actual = jest.requireActual(
    "@/src/lib/floor/store"
  ) as typeof import("@/src/lib/floor/store");
  return {
    ...actual,
    recordToolCall: jest.fn(actual.recordToolCall),
    putFingerprint: jest.fn(actual.putFingerprint),
  };
});

import {
  recordBuild,
  recordToolInvocation,
} from "@/src/lib/floor/telemetry";
import {
  __clearFloorStoreForTests,
  floorDateKey,
  getDailyCallCount,
  getFingerprint,
  getNonceIndex,
  getRecentTelemetry,
  putFingerprint,
  recordToolCall,
} from "@/src/lib/floor/store";
import { encodeWatermark, findWatermark, fingerprint } from "@/src/lib/agent/watermark";
import type { Hex } from "viem";

const TO = "0x6C3D0E968d3C986886EEECA6Ba6Fecc949F17F6e";

/** Calldata-shaped blob carrying an embedded watermark, like a real build. */
function watermarkedData(agentId?: string): Hex {
  return ("0x12345678" + encodeWatermark({ agentId }).slice(2)) as Hex;
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.VERCEL_ENV;
  __clearFloorStoreForTests();
  jest.clearAllMocks();
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("recordToolInvocation", () => {
  it("increments the daily counter and appends a telemetry event", async () => {
    await recordToolInvocation({
      tool: "list_streme_tokens",
      params: { query: "streme" },
    });

    expect(await getDailyCallCount(floorDateKey(Date.now()))).toBe(1);
    const recent = await getRecentTelemetry(5);
    expect(recent).toHaveLength(1);
    expect(recent[0].tool).toBe("list_streme_tokens");
    expect(recent[0].at).toBeGreaterThan(0);
  });

  it("stores a params digest, never the raw params (plan R5)", async () => {
    const tokenAddress = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
    const ethAmount = "0.0123";
    await recordToolInvocation({
      tool: "build_buy_transaction",
      params: { tokenAddress, ethAmount },
    });

    const recent = await getRecentTelemetry(5);
    const serialized = JSON.stringify(recent[0]);
    expect(serialized).not.toContain(tokenAddress);
    expect(serialized).not.toContain(ethAmount);
    expect(recent[0].paramsDigest).toMatch(/^0x[0-9a-f]{16}$/);
  });

  it("stores the sanitized agentId", async () => {
    await recordToolInvocation({
      tool: "build_stake_transaction",
      params: {},
      agentId: "  My-Agent.1  ",
    });
    const recent = await getRecentTelemetry(5);
    expect(recent[0].agentId).toBe("my-agent.1");
  });

  it("stores null for an invalid agentId instead of throwing", async () => {
    await expect(
      recordToolInvocation({
        tool: "build_stake_transaction",
        params: {},
        agentId: "bad!!chars",
      })
    ).resolves.toBeUndefined();
    const recent = await getRecentTelemetry(5);
    expect(recent[0].agentId).toBeNull();
  });

  it("never rejects when the store write throws", async () => {
    (recordToolCall as jest.Mock).mockImplementationOnce(() => {
      throw new Error("redis down");
    });
    await expect(
      recordToolInvocation({ tool: "get_streme_pulse", params: {} })
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("never rejects when the store write rejects", async () => {
    (recordToolCall as jest.Mock).mockRejectedValueOnce(
      new Error("redis down") as never
    );
    await expect(
      recordToolInvocation({ tool: "get_streme_pulse", params: {} })
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("recordBuild", () => {
  it("writes a fingerprint record retrievable by fingerprint and by nonce", async () => {
    const data = watermarkedData("test-agent");
    await recordBuild({
      tool: "build_stake_transaction",
      agentId: "test-agent",
      to: TO,
      data,
    });

    const fp = fingerprint(TO, data);
    const record = await getFingerprint(fp);
    expect(record).not.toBeNull();
    expect(record?.tool).toBe("build_stake_transaction");
    expect(record?.agentId).toBe("test-agent");
    expect(record?.builtAt).toBeGreaterThan(0);

    // Nonce decoded from the same data joins back to the fingerprint
    const nonce = findWatermark(data)?.nonce;
    expect(nonce).toBeDefined();
    expect(record?.nonce).toBe(nonce);
    expect(await getNonceIndex(nonce!)).toBe(fp.toLowerCase());
  });

  it("records a null nonce when the data carries no watermark", async () => {
    const data = "0x1234567890abcdef" as Hex;
    await recordBuild({ tool: "build_buy_transaction", to: TO, data });
    const record = await getFingerprint(fingerprint(TO, data));
    expect(record?.nonce).toBeNull();
  });

  it("sanitizes a reserved agentId to null instead of throwing", async () => {
    const data = watermarkedData();
    await expect(
      recordBuild({
        tool: "build_stake_transaction",
        agentId: "streme-resident",
        to: TO,
        data,
      })
    ).resolves.toBeUndefined();
    const record = await getFingerprint(fingerprint(TO, data));
    expect(record?.agentId).toBeNull();
  });

  it("never rejects when the fingerprint write fails", async () => {
    (putFingerprint as jest.Mock).mockRejectedValueOnce(
      new Error("redis down") as never
    );
    await expect(
      recordBuild({
        tool: "build_stake_transaction",
        to: TO,
        data: watermarkedData(),
      })
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
