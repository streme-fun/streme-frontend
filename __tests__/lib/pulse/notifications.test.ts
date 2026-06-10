import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  buildMilestoneNotification,
  notifyMilestoneHolders,
} from "@/src/lib/pulse/notifications";
import type { Milestone } from "@/src/lib/pulse/types";

const NOW = 1_780_000_000;

const milestone: Milestone = {
  id: "market_cap:0xabc0000000000000000000000000000000000001:100000",
  type: "market_cap",
  tokenAddress: "0xabc0000000000000000000000000000000000001",
  symbol: "TEST",
  name: "Test Token",
  creatorUsername: "alice",
  threshold: 100_000,
  value: 120_000,
  detectedAt: NOW,
};

const ENV_KEYS = [
  "PULSE_NOTIFICATIONS_ENABLED",
  "NEYNAR_API_KEY",
  "NEYNAR_CLIENT_ID",
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  (global.fetch as jest.Mock).mockReset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  jest.restoreAllMocks();
});

function holdersResponse(holders: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => holders,
    text: async () => JSON.stringify(holders),
  } as unknown as Response;
}

describe("buildMilestoneNotification", () => {
  it("includes the symbol, threshold, and token deep link", () => {
    const n = buildMilestoneNotification(milestone);
    expect(n.title).toBe("$TEST crossed $100k");
    expect(n.body).toContain("$100k market cap");
    expect(n.targetUrl).toContain(`/token/${milestone.tokenAddress}`);
  });
});

describe("notifyMilestoneHolders", () => {
  const holders = [
    { hasFarcaster: true, farcaster: { fid: 1 } },
    { hasFarcaster: true, farcaster: { fid: 2 } },
    { hasFarcaster: false },
    { hasFarcaster: true, farcaster: { fid: 1 } }, // duplicate fid
  ];

  it("dry-runs with the real target count when sending is disabled", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(holdersResponse(holders));

    const record = await notifyMilestoneHolders(milestone, { now: NOW });

    expect(record.status).toBe("dry_run");
    expect(record.targetCount).toBe(2); // deduped, farcaster-only
    expect(fetchSpy).toHaveBeenCalledTimes(1); // holders fetch only, no send
  });

  it("skips when the token has no Farcaster holders", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(holdersResponse([{ hasFarcaster: false }]));

    const record = await notifyMilestoneHolders(milestone, { now: NOW });
    expect(record.status).toBe("skipped");
    expect(record.targetCount).toBe(0);
  });

  it("records a failure when the holders API errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "boom",
    } as unknown as Response);

    const record = await notifyMilestoneHolders(milestone, { now: NOW });
    expect(record.status).toBe("failed");
    expect(record.error).toContain("500");
  });

  it("sends via Neynar when fully configured", async () => {
    process.env.PULSE_NOTIFICATIONS_ENABLED = "true";
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.NEYNAR_CLIENT_ID = "test-client";

    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(async (url) => {
        if (String(url).includes("api.streme.fun")) {
          return holdersResponse(holders);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
          text: async () => "{}",
        } as unknown as Response;
      });

    const record = await notifyMilestoneHolders(milestone, { now: NOW });

    expect(record.status).toBe("sent");
    expect(record.mode).toBe("neynar");
    expect(record.targetCount).toBe(2);

    const neynarCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("api.neynar.com")
    );
    expect(neynarCall).toBeDefined();
    const body = JSON.parse((neynarCall![1] as RequestInit).body as string);
    expect(body.target_fids).toEqual([1, 2]);
    expect(body.notification.target_url).toContain("/token/");
  });

  it("honors forceDryRun even when fully configured", async () => {
    process.env.PULSE_NOTIFICATIONS_ENABLED = "true";
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.NEYNAR_CLIENT_ID = "test-client";

    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(holdersResponse(holders));

    const record = await notifyMilestoneHolders(milestone, {
      now: NOW,
      forceDryRun: true,
    });

    expect(record.status).toBe("dry_run");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // holders fetch only
  });
});
