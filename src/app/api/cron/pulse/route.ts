// Vercel cron entrypoint for the Pulse engine (see vercel.json crons).
//
// Auth model: when CRON_SECRET is set, Vercel sends it as a Bearer token and
// we require it. When it isn't set (local dev, preview), the run is forced
// into dry-run mode so no casts can ever be published from an open endpoint.

import { NextRequest } from "next/server";
import { runPulse } from "@/src/lib/pulse/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  let forceDryRun = request.nextUrl.searchParams.get("dry") === "1";

  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    forceDryRun = true;
  }

  // Time-travel preview (dry-run only): ?dry=1&at=2026-06-11T16:30:00Z lets
  // an operator see exactly what the bot would broadcast at that moment.
  let now: Date | undefined;
  const at = request.nextUrl.searchParams.get("at");
  if (at && forceDryRun) {
    const parsed = new Date(at);
    if (!Number.isNaN(parsed.getTime())) now = parsed;
  }

  try {
    const report = await runPulse({ forceDryRun, now });
    return Response.json(report);
  } catch (error) {
    console.error("[Pulse Cron] Run failed:", error);
    return Response.json(
      {
        error: "Pulse run failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
