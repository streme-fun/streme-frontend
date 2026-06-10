// Public pulse data for the /pulse page (and anyone else — the snapshot is
// intentionally open data: ranked tokens, milestones, and the bot's
// activity log).
//
// Reads the latest stored snapshot; when state is cold (no cron configured
// yet, or fresh in-memory store) it computes a read-only snapshot on demand
// so the page always has data.

import { computeSnapshot } from "@/src/lib/pulse/engine";
import {
  getLatestSnapshot,
  getRecentCasts,
  getRecentMilestones,
  getRecentNotifications,
  setLatestSnapshot,
} from "@/src/lib/pulse/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SNAPSHOT_STALE_SECONDS = 30 * 60;

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);

    let snapshot = await getLatestSnapshot();
    if (!snapshot || now - snapshot.generatedAt > SNAPSHOT_STALE_SECONDS) {
      snapshot = await computeSnapshot(now);
      await setLatestSnapshot(snapshot);
    }

    const [milestones, casts, notifications] = await Promise.all([
      getRecentMilestones(),
      getRecentCasts(),
      getRecentNotifications(),
    ]);

    return Response.json(
      { snapshot, milestones, casts, notifications },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[Pulse API] Error:", error);
    return Response.json(
      { error: "Failed to load pulse data" },
      { status: 500 }
    );
  }
}
