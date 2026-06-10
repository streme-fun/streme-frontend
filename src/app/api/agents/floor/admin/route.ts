// Resident kill switch (plan U7): authed halt/resume on the Redis flag —
// immediate, no redeploy (unlike env flags).
//
//   GET  → { halted }                       (bearer FLOOR_ADMIN_SECRET)
//   POST { action: "halt" | "resume" }      (bearer FLOOR_ADMIN_SECRET)
//
// 503 when the secret isn't configured, 401 on mismatch. The secret and the
// Authorization header are never echoed or logged.

import { NextRequest } from "next/server";
import { getResidentHalt, setResidentHalt } from "@/src/lib/floor/store";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Returns an error response, or null when authorized. Never logs auth. */
function unauthorized(request: NextRequest): Response | null {
  const secret = process.env.FLOOR_ADMIN_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Admin controls are not configured" },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;
  return Response.json({ halted: await getResidentHalt() });
}

export async function POST(request: NextRequest) {
  const denied = unauthorized(request);
  if (denied) return denied;

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (body.action !== "halt" && body.action !== "resume") {
    return Response.json(
      { error: `action must be "halt" or "resume"` },
      { status: 400 }
    );
  }

  await setResidentHalt(body.action === "halt");
  return Response.json({ halted: await getResidentHalt() });
}
