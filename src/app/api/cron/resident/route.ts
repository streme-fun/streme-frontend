// Vercel cron entrypoint for the Resident engine (see vercel.json crons).
//
// Auth model mirrors /api/cron/floor: when CRON_SECRET is set, Vercel sends
// it as a Bearer token and we require it. When it isn't set (local dev,
// preview), the run is forced into dry-run mode so an open endpoint can
// never sign or broadcast. The engine's own fail-closed gates apply on top
// (RESIDENT_ENABLED + key + ANTHROPIC_API_KEY + live Redis).

import { NextRequest } from "next/server";
import { runResident } from "@/src/lib/resident/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  let dryRun = request.nextUrl.searchParams.get("dry") === "1";

  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    dryRun = true;
  }

  try {
    const report = await runResident({ dryRun });
    return Response.json(report);
  } catch (error) {
    console.error("[Resident Cron] Run failed:", error);
    return Response.json(
      {
        error: "Resident run failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
