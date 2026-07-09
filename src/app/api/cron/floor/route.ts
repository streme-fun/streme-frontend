// Vercel cron entrypoint for the Agent Floor watcher (see vercel.json crons).
//
// Auth model mirrors /api/cron/pulse: when CRON_SECRET is set, Vercel sends
// it as a Bearer token and we require it. When it isn't set (local dev,
// preview), the run is forced into dry-run mode so an open endpoint can never
// publish events, bump counters, or advance the cursor.

import { NextRequest } from "next/server";
import { runWatcher } from "@/src/lib/floor/watcher";

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
    const result = await runWatcher({ dryRun });
    return Response.json(result);
  } catch (error) {
    console.error("[Floor Cron] Run failed:", error);
    return Response.json(
      {
        error: "Floor watcher run failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
