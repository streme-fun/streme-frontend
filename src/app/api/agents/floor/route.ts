// Agent Floor snapshot — public data for the /agents page (plan U5).
//
// Serves the watcher's chain-verified events and daily counters plus the
// best-effort (explicitly unverified) tool-call count. Mirrors the /api/pulse
// serving pattern: 60s CDN cache, stale-while-revalidate.
//
// Degradation contract: malformed or unavailable store data collapses to
// empty arrays / zero counters — this route never 500s over a Redis hiccup.

import { isAddressBlacklisted } from "@/src/lib/blacklist";
import {
  floorDateKey,
  getDailyCallCount,
  getRecentEvents,
  getVerifiedCounters,
  type FloorEvent,
  type VerifiedCountersSnapshot,
} from "@/src/lib/floor/store";
import type {
  FloorCountersShape,
  FloorSnapshot,
} from "@/src/components/floor/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EVENTS_LIMIT = 50;
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

function emptyCounters(date: string): FloorCountersShape {
  return {
    date,
    volumeEthExternal: 0,
    volumeEthResident: 0,
    activeAgentWallets: 0,
    buys: 0,
    stakes: 0,
    unstakes: 0,
    connects: 0,
    streamsOpened: 0,
  };
}

function shapeCounters(snapshot: VerifiedCountersSnapshot): FloorCountersShape {
  return {
    date: snapshot.date,
    volumeEthExternal: snapshot.volumeEth,
    volumeEthResident: snapshot.residentVolumeEth,
    activeAgentWallets: snapshot.activeWallets,
    buys: snapshot.byKind.buy,
    stakes: snapshot.byKind.stake,
    unstakes: snapshot.byKind.unstake,
    connects: snapshot.byKind.connect,
    streamsOpened: snapshot.byKind.stream,
  };
}

function allZero(counters: FloorCountersShape): boolean {
  return (
    counters.volumeEthExternal === 0 &&
    counters.volumeEthResident === 0 &&
    counters.activeAgentWallets === 0 &&
    counters.buys === 0 &&
    counters.stakes === 0 &&
    counters.unstakes === 0 &&
    counters.connects === 0 &&
    counters.streamsOpened === 0
  );
}

/** Run one store read; any failure degrades to the fallback, never a 500. */
async function safe<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[Floor API] ${label} failed (degraded):`, error);
    return fallback;
  }
}

export async function GET() {
  const now = Date.now();
  const todayKey = floorDateKey(now);
  const yesterdayKey = floorDateKey(now - 24 * 3600 * 1000);

  const [rawEvents, today, yesterday, unverifiedToolCallsToday] =
    await Promise.all([
      safe("events", () => getRecentEvents(EVENTS_LIMIT), [] as FloorEvent[]),
      safe(
        "counters (today)",
        async () => shapeCounters(await getVerifiedCounters(todayKey)),
        emptyCounters(todayKey)
      ),
      safe(
        "counters (yesterday)",
        async () => shapeCounters(await getVerifiedCounters(yesterdayKey)),
        emptyCounters(yesterdayKey)
      ),
      safe("tool-call count", () => getDailyCallCount(todayKey), 0),
    ]);

  // Defense-in-depth (plan R18): the gateway already rejects blacklisted
  // tokens at build time, but a blacklist addition after an event was
  // published must still keep it out of the feed.
  const events = rawEvents.filter(
    (event) => !event.token || !isAddressBlacklisted(event.token, "token")
  );

  const payload: FloorSnapshot = {
    events,
    counters: { today, yesterday },
    secondary: { unverifiedToolCallsToday },
    coldStart: events.length === 0 || (allZero(today) && allZero(yesterday)),
    // Phase C fills the Resident section; the key is shaped now so the
    // client contract doesn't change when it lands.
    resident: null,
    generatedAt: now,
  };

  return Response.json(payload, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
