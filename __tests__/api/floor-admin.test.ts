// Resident kill-switch admin API tests (review #4) — route handlers imported
// directly, halt flag exercised through the floor store's in-memory fallback
// (no Redis env in tests), following __tests__/api/floor.test.ts.

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { NextRequest } from "next/server";

import { GET, POST } from "@/src/app/api/agents/floor/admin/route";
import {
  __clearFloorStoreForTests,
  getResidentHalt,
  setResidentHalt,
} from "@/src/lib/floor/store";

const ADMIN_URL = "http://localhost:3000/api/agents/floor/admin";
// Distinctive marker so the "never echoed" assertions can't false-negative.
const SECRET = "floor-admin-secret-marker-9f8e7d";

function getRequest(auth?: string): NextRequest {
  return new NextRequest(ADMIN_URL, {
    method: "GET",
    headers: auth ? { authorization: auth } : {},
  });
}

function postRequest(body: unknown, auth?: string): NextRequest {
  return new NextRequest(ADMIN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  // Force the store's in-memory fallback and a clean auth slate. next/jest
  // loads .env files, so these may otherwise be populated.
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.VERCEL_ENV;
  delete process.env.FLOOR_ADMIN_SECRET;
  __clearFloorStoreForTests();
});

afterEach(() => {
  delete process.env.FLOOR_ADMIN_SECRET;
});

describe("/api/agents/floor/admin — FLOOR_ADMIN_SECRET unset", () => {
  it("returns 503 for GET", async () => {
    const response = await GET(getRequest());
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe("Admin controls are not configured");
  });

  it("returns 503 for POST, without touching the halt flag", async () => {
    const response = await POST(postRequest({ action: "halt" }));
    expect(response.status).toBe(503);
    expect(await getResidentHalt()).toBe(false);
  });
});

describe("/api/agents/floor/admin — auth failures", () => {
  beforeEach(() => {
    process.env.FLOOR_ADMIN_SECRET = SECRET;
  });

  it("returns 401 for GET and POST with a wrong bearer", async () => {
    const getResponse = await GET(getRequest("Bearer wrong-secret"));
    expect(getResponse.status).toBe(401);

    const postResponse = await POST(
      postRequest({ action: "halt" }, "Bearer wrong-secret")
    );
    expect(postResponse.status).toBe(401);
    expect(await getResidentHalt()).toBe(false);
  });

  it("returns 401 for GET and POST with no authorization header", async () => {
    const getResponse = await GET(getRequest());
    expect(getResponse.status).toBe(401);

    const postResponse = await POST(postRequest({ action: "halt" }));
    expect(postResponse.status).toBe(401);
    expect(await getResidentHalt()).toBe(false);
  });
});

describe("/api/agents/floor/admin — authorized", () => {
  beforeEach(() => {
    process.env.FLOOR_ADMIN_SECRET = SECRET;
  });

  it("POST halt → 200, flag true; POST resume → 200, flag false", async () => {
    const haltResponse = await POST(
      postRequest({ action: "halt" }, `Bearer ${SECRET}`)
    );
    expect(haltResponse.status).toBe(200);
    expect(await haltResponse.json()).toEqual({ halted: true });
    expect(await getResidentHalt()).toBe(true);

    const resumeResponse = await POST(
      postRequest({ action: "resume" }, `Bearer ${SECRET}`)
    );
    expect(resumeResponse.status).toBe(200);
    expect(await resumeResponse.json()).toEqual({ halted: false });
    expect(await getResidentHalt()).toBe(false);
  });

  it("GET reflects the current halt state", async () => {
    await setResidentHalt(true);
    const haltedResponse = await GET(getRequest(`Bearer ${SECRET}`));
    expect(haltedResponse.status).toBe(200);
    expect(await haltedResponse.json()).toEqual({ halted: true });

    await setResidentHalt(false);
    const resumedResponse = await GET(getRequest(`Bearer ${SECRET}`));
    expect(resumedResponse.status).toBe(200);
    expect(await resumedResponse.json()).toEqual({ halted: false });
  });

  it("returns 400 for an invalid action, leaving the flag untouched", async () => {
    const response = await POST(
      postRequest({ action: "explode" }, `Bearer ${SECRET}`)
    );
    expect(response.status).toBe(400);
    expect(await getResidentHalt()).toBe(false);
  });

  it("returns 400 for a non-JSON body", async () => {
    const response = await POST(postRequest("not-json", `Bearer ${SECRET}`));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Body must be JSON");
  });
});

describe("/api/agents/floor/admin — secret never echoed", () => {
  it("keeps the secret out of every response body across all branches", async () => {
    // 503 branch (secret unset — body still must not leak prior config).
    const unconfigured = await GET(getRequest());
    expect(await unconfigured.text()).not.toContain(SECRET);

    process.env.FLOOR_ADMIN_SECRET = SECRET;

    const responses = await Promise.all([
      GET(getRequest("Bearer wrong-secret")), // 401
      POST(postRequest({ action: "halt" })), // 401, no header
      GET(getRequest(`Bearer ${SECRET}`)), // 200
      POST(postRequest({ action: "halt" }, `Bearer ${SECRET}`)), // 200
      POST(postRequest({ action: "explode" }, `Bearer ${SECRET}`)), // 400
      POST(postRequest("not-json", `Bearer ${SECRET}`)), // 400
    ]);

    for (const response of responses) {
      expect(await response.text()).not.toContain(SECRET);
    }
  });
});
