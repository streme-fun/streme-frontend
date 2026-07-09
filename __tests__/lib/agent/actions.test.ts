import { beforeEach, describe, expect, it } from "@jest/globals";

// actions.ts pulls the pulse engine/store (for getPulse) whose @upstash/redis
// dependency ships untransformed ESM — mock them out; they're not under test.
// Uses the global `jest` (not the @jest/globals import) so SWC hoists these
// above the module imports.
jest.mock("@/src/lib/pulse/engine", () => ({ computeSnapshot: jest.fn() }));
jest.mock("@/src/lib/pulse/store", () => ({
  getLatestSnapshot: jest.fn(),
  setLatestSnapshot: jest.fn(),
}));

import {
  AgentInputError,
  buildBuyTxForToken,
  buildStakeTxForToken,
  buildStreamTxForToken,
  getToken,
} from "@/src/lib/agent/actions";
import { findWatermark } from "@/src/lib/agent/watermark";
import { CFA_V1_FORWARDER } from "@/src/lib/superfluid-contracts";

// Mock fetch for the upstream Streme token API
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// First entry of BLACKLISTED_TOKENS (stored lowercase in the blacklist)
const BLACKLISTED = "0x1eff3dd78f4a14abfa9fa66579bd3ce9e1b30529";
const BLACKLISTED_MIXED_CASE = "0x1efF3Dd78F4A14aBfa9Fa66579bD3Ce9E1B30529";
const TOKEN = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
const WALLET = "0x09a900eb2ff6e9aca12d4d1a396ddc9be0307661";

const upstreamToken = {
  contract_address: TOKEN,
  name: "Streme",
  symbol: "$STREME",
  username: "creator",
  type: "v2",
  staking_address: "0x93419f1c0f73b278c73085c17407794a6580deff",
  staking_pool: "0xa040a8564c433970d7919c441104b1d25b9eaa1c",
};

function mockTokenResponse(token: Record<string, unknown>) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: token }),
  } as never);
}

describe("getToken blacklist enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a blacklisted token address without fetching", async () => {
    await expect(getToken(BLACKLISTED)).rejects.toThrow(AgentInputError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a mixed-case blacklisted address", async () => {
    await expect(getToken(BLACKLISTED_MIXED_CASE)).rejects.toThrow(
      AgentInputError
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a token from a blacklisted spammer username", async () => {
    mockTokenResponse({ ...upstreamToken, username: "bedik" });
    await expect(getToken(TOKEN)).rejects.toThrow(AgentInputError);
  });

  it("resolves a non-blacklisted token", async () => {
    mockTokenResponse(upstreamToken);
    const token = await getToken(TOKEN);
    expect(token.address).toBe(TOKEN);
    expect(token.symbol).toBe("STREME");
  });
});

describe("build paths inherit the blacklist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a buy build for a blacklisted token", async () => {
    await expect(
      buildBuyTxForToken({ tokenAddress: BLACKLISTED, ethAmount: "0.01" })
    ).rejects.toThrow(AgentInputError);
  });

  it("rejects a stake build for a blacklisted token", async () => {
    await expect(
      buildStakeTxForToken({
        tokenAddress: BLACKLISTED_MIXED_CASE,
        amount: "100",
      })
    ).rejects.toThrow(AgentInputError);
  });

  it("rejects a stream build for a blacklisted token", async () => {
    await expect(
      buildStreamTxForToken({
        tokenAddress: BLACKLISTED,
        receiver: WALLET,
        tokensPerDay: "100",
      })
    ).rejects.toThrow(AgentInputError);
  });

  it("still builds a stake for a non-blacklisted token", async () => {
    mockTokenResponse(upstreamToken);
    const built = await buildStakeTxForToken({
      tokenAddress: TOKEN,
      amount: "100",
    });
    expect(built.tx.to).toBe(TOKEN);
  });
});

describe("buildStreamTxForToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves the token through getToken, then builds the stream tx", async () => {
    mockTokenResponse(upstreamToken);
    const built = await buildStreamTxForToken({
      tokenAddress: TOKEN,
      receiver: WALLET,
      tokensPerDay: "100",
      agentId: "pulse-hunter",
    });

    // Token resolution hit the upstream API (the old raw re-export skipped it)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(TOKEN),
      expect.anything()
    );
    expect(built.tx.to).toBe(CFA_V1_FORWARDER);
    expect(built.tx.chainId).toBe(8453);
    // Carries the calldata-suffix watermark
    expect(findWatermark(built.tx.data)).not.toBeNull();
  });
});
