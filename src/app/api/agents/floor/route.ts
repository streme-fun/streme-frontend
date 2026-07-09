// Agent Floor snapshot — public data for the /agents page (plan U5).
//
// Serves the watcher's chain-verified events and daily counters plus the
// best-effort (explicitly unverified) tool-call count. Mirrors the /api/pulse
// serving pattern: 60s CDN cache, stale-while-revalidate.
//
// Degradation contract: malformed or unavailable store data collapses to
// empty arrays / zero counters — this route never 500s over a Redis hiccup.

import { formatEther } from "viem";
import { isAddressBlacklisted } from "@/src/lib/blacklist";
import {
  floorDateKey,
  getDailyCallCount,
  getRecentEvents,
  getResidentHalt,
  getResidentSpend,
  getVerifiedCounters,
  type FloorEvent,
  type VerifiedCountersSnapshot,
} from "@/src/lib/floor/store";
import { getJournal, type ResidentJournalEntry } from "@/src/lib/resident/journal";
import { getAccountYield } from "@/src/lib/yield";
import { publicClient } from "@/src/lib/viemClient";
import type {
  FloorCountersShape,
  FloorSnapshot,
  ResidentSection,
  ResidentYieldShape,
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

const RESIDENT_JOURNAL_LIMIT = 12;

/**
 * Compose the Resident section (plan U8). Null when RESIDENT_ADDRESS is
 * unset (the panel keeps its "coming online" placeholder). Every read is
 * individually guarded — a failed field degrades to null, never a 500.
 *
 * `verifiedEvents` are filtered from the already-served (blacklist-filtered)
 * events list: chain-grounded P&L inputs. The spend ledger is caps-only.
 */
async function buildResidentSection(
  now: number,
  events: FloorEvent[]
): Promise<ResidentSection | null> {
  // The watcher's convention (U4): RESIDENT_ADDRESS identifies the house
  // wallet. Only the address is needed here — never the signer module.
  const address = process.env.RESIDENT_ADDRESS?.toLowerCase();
  if (!address) return null;

  const [halted, journal, residentYield, ethBalance, spentTodayEth] =
    await Promise.all([
      safe<boolean | null>("resident halt", () => getResidentHalt(), null),
      safe<ResidentJournalEntry[] | null>(
        "resident journal",
        () => getJournal(RESIDENT_JOURNAL_LIMIT),
        null
      ),
      safe<ResidentYieldShape | null>(
        "resident yield",
        async () => {
          const { totalUsdPerDay, activeStreams } =
            await getAccountYield(address);
          // USD may be unreliable when upstream marketData is stale —
          // pass through; the client handles display degradation.
          return { totalUsdPerDay, activeStreams };
        },
        null
      ),
      safe<string | null>(
        "resident balance",
        async () =>
          formatEther(
            await publicClient.getBalance({
              address: address as `0x${string}`,
            })
          ),
        null
      ),
      safe<number | null>(
        "resident spend",
        () => getResidentSpend(floorDateKey(now)),
        null
      ),
    ]);

  return {
    address,
    halted,
    journal,
    yield: residentYield,
    ethBalance,
    spentTodayEth,
    verifiedEvents: events.filter(
      (event) => event.wallet.toLowerCase() === address
    ),
  };
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

  const resident = await buildResidentSection(now, events);

  const payload: FloorSnapshot = {
    events,
    counters: { today, yesterday },
    secondary: { unverifiedToolCallsToday },
    coldStart: events.length === 0 || (allZero(today) && allZero(yesterday)),
    resident,
    generatedAt: now,
  };

  return Response.json(payload, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      // Agents read this endpoint cross-origin, same as /api/agent/*.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
