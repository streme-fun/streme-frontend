// Cron route auth-branch tests (review #6) — /api/cron/floor and
// /api/cron/resident handlers imported directly. The heavy run functions are
// mocked at the module boundary so no chain/LLM code loads; only the shared
// auth/dry-run wrapper is under test.

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { NextRequest } from "next/server";

// Bare top-level jest.mock calls (SWC hoists these above the imports below);
// factories reference only inline jest.fn so hoisting is safe.
jest.mock("@/src/lib/floor/watcher", () => ({
  runWatcher: jest.fn(),
}));
jest.mock("@/src/lib/resident/engine", () => ({
  runResident: jest.fn(),
}));

import { GET as floorCronGET } from "@/src/app/api/cron/floor/route";
import { GET as residentCronGET } from "@/src/app/api/cron/resident/route";
import { runWatcher } from "@/src/lib/floor/watcher";
import { runResident } from "@/src/lib/resident/engine";

const SECRET = "cron-secret-for-tests";

const ROUTES = [
  {
    name: "floor",
    url: "http://localhost:3000/api/cron/floor",
    handler: floorCronGET,
    runFn: runWatcher as unknown as jest.Mock,
    report: { scannedBlocks: 12, published: 3, dryRun: false },
  },
  {
    name: "resident",
    url: "http://localhost:3000/api/cron/resident",
    handler: residentCronGET,
    runFn: runResident as unknown as jest.Mock,
    report: { decision: "buy", journalId: "j-42", dryRun: false },
  },
] as const;

function request(url: string, auth?: string): NextRequest {
  return new NextRequest(url, {
    method: "GET",
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  // next/jest loads .env files — clear so each test fully controls auth mode.
  delete process.env.CRON_SECRET;
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe.each(ROUTES)("GET /api/cron/$name", ({ url, handler, runFn, report }) => {
  describe("CRON_SECRET set", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = SECRET;
    });

    it("returns 401 on a wrong bearer and never invokes the run fn", async () => {
      const response = await handler(request(url, "Bearer wrong-secret"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(runFn).not.toHaveBeenCalled();
    });

    it("returns 401 on a missing authorization header and never invokes the run fn", async () => {
      const response = await handler(request(url));
      expect(response.status).toBe(401);
      expect(runFn).not.toHaveBeenCalled();
    });

    it("returns 200 on the correct bearer, runs live (dryRun false), and passes the report through", async () => {
      runFn.mockResolvedValue(report as never);
      const response = await handler(request(url, `Bearer ${SECRET}`));
      expect(response.status).toBe(200);
      expect(runFn).toHaveBeenCalledTimes(1);
      expect(runFn).toHaveBeenCalledWith({ dryRun: false });
      expect(await response.json()).toEqual(report);
    });

    it("honors ?dry=1 when authorized (dryRun true)", async () => {
      runFn.mockResolvedValue({ ...report, dryRun: true } as never);
      const response = await handler(request(`${url}?dry=1`, `Bearer ${SECRET}`));
      expect(response.status).toBe(200);
      expect(runFn).toHaveBeenCalledWith({ dryRun: true });
      expect(await response.json()).toEqual({ ...report, dryRun: true });
    });
  });

  describe("CRON_SECRET unset", () => {
    it("returns 200 but forces dryRun true even without ?dry=1", async () => {
      const dryReport = { ...report, dryRun: true };
      runFn.mockResolvedValue(dryReport as never);
      const response = await handler(request(url));
      expect(response.status).toBe(200);
      expect(runFn).toHaveBeenCalledTimes(1);
      expect(runFn).toHaveBeenCalledWith({ dryRun: true });
      expect(await response.json()).toEqual(dryReport);
    });
  });
});
