"use client";

// Live Agent Floor content (plan U5) — mirrors the /pulse polling pattern:
// fetch on mount + 60s interval, spinner on first load, alert-error with
// retry only when there is NO data, and a non-blocking "may be stale"
// indicator when a refresh fails but data exists (never blank the feed).
//
// Layout contract (review-refined, non-negotiable): the ResidentPanel is
// the FIRST content block in EVERY state — loading, error, cold start, live.

import { useCallback, useEffect, useState } from "react";
import FeedItem from "@/src/components/floor/FeedItem";
import FloorCounters from "@/src/components/floor/FloorCounters";
import ResidentPanel from "@/src/components/floor/ResidentPanel";
import type { FloorSnapshot } from "@/src/components/floor/types";

const REFRESH_INTERVAL_MS = 60_000;

function SecondaryStats({ toolCalls }: { toolCalls: number }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 text-xs opacity-70">
      <span className="font-mono">{toolCalls.toLocaleString()}</span>
      <span>gateway tool calls today</span>
      <span className="badge badge-ghost badge-xs">
        self-reported / unverified
      </span>
    </div>
  );
}

export default function FloorContent() {
  const [data, setData] = useState<FloorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFloor = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/floor");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot: FloorSnapshot = await response.json();
      setData(snapshot);
      setError(null);
    } catch (err) {
      console.error("Error fetching floor data:", err);
      setError("Failed to load floor data");
    }
  }, []);

  useEffect(() => {
    fetchFloor();
    const interval = setInterval(fetchFloor, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchFloor]);

  // Error with no data at all: Resident slot stays first, then the retry.
  if (error && !data) {
    return (
      <div>
        <ResidentPanel resident={null} />
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={fetchFloor}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // First load: Resident slot first, then the spinner.
  if (!data) {
    return (
      <div>
        <ResidentPanel resident={null} />
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ResidentPanel resident={data.resident} />

      {error && (
        <div className="mb-4 flex items-center gap-2 text-xs opacity-70">
          <span className="badge badge-warning badge-xs" />
          <span>data may be stale — retrying automatically</span>
        </div>
      )}

      <FloorCounters
        today={data.counters.today}
        yesterday={data.counters.yesterday}
        coldStart={data.coldStart}
      />

      <section>
        <h2 className="text-xl font-semibold mb-4">Live Feed</h2>
        {data.events.length === 0 ? (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body items-center text-center py-12">
              <p className="font-semibold">
                The floor is opening — agents are connecting.
              </p>
              <p className="text-sm opacity-70 max-w-md">
                Every chain-verified agent buy, stake, and stream shows up
                here the moment it confirms on Base. Yours could be first.
              </p>
              <a href="#build-your-own-agent" className="btn btn-primary btn-sm mt-2">
                Build your own agent
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data.events.map((event) => (
              <FeedItem key={event.txHash} event={event} />
            ))}
          </div>
        )}
      </section>

      <SecondaryStats toolCalls={data.secondary.unverifiedToolCallsToday} />
    </div>
  );
}
