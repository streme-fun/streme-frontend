"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SafeImage from "@/src/components/SafeImage";
import type {
  CastRecord,
  Milestone,
  PulseSnapshot,
} from "@/src/lib/pulse/types";
import {
  formatCountCompact,
  formatPercentChange,
  formatUsdCompact,
} from "@/src/lib/pulse/format";

const REFRESH_INTERVAL_MS = 60_000;

interface PulseData {
  snapshot: PulseSnapshot;
  milestones: Milestone[];
  casts: CastRecord[];
}

function relativeTime(unixSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "$0";
  if (price >= 0.01) return `$${price.toFixed(2)}`;
  // Expand tiny prices instead of scientific notation: $0.00000017
  const decimals = Math.min(12, -Math.floor(Math.log10(price)) + 2);
  return `$${price.toFixed(decimals)}`;
}

const CAST_STATUS_BADGES: Record<CastRecord["status"], string> = {
  published: "badge-success",
  dry_run: "badge-info",
  failed: "badge-error",
  skipped: "badge-ghost",
};

export default function PulseContent() {
  const [data, setData] = useState<PulseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPulse = useCallback(async () => {
    try {
      const response = await fetch("/api/pulse");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const pulseData: PulseData = await response.json();
      setData(pulseData);
      setError(null);
    } catch (err) {
      console.error("Error fetching pulse data:", err);
      setError("Failed to load pulse data");
    }
  }, []);

  useEffect(() => {
    fetchPulse();
    const interval = setInterval(fetchPulse, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPulse]);

  if (error && !data) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-6xl text-center">
        <div className="alert alert-error max-w-md mx-auto">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-4xl font-bold">Streme Pulse</h1>
        </div>
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  const { snapshot, milestones, casts } = data;

  return (
    <div className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold">Streme Pulse</h1>
          <span className="relative flex h-3 w-3 mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
          </span>
        </div>
        <p className="mt-2 opacity-70">
          What&apos;s streaming right now — live rankings, milestones, and the
          automated @streme broadcast log. Updated {relativeTime(snapshot.generatedAt)}.
        </p>
      </div>

      {/* Totals */}
      <div className="stats stats-vertical sm:stats-horizontal shadow w-full mb-10 bg-base-100">
        <div className="stat">
          <div className="stat-title">24h Volume</div>
          <div className="stat-value text-primary font-mono">
            {formatUsdCompact(snapshot.totals.volume24h)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Active Tokens (24h)</div>
          <div className="stat-value font-mono">
            {formatCountCompact(snapshot.totals.activeTokens24h)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Launches (7d)</div>
          <div className="stat-value font-mono">
            {formatCountCompact(snapshot.totals.launches7d)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Combined Market Cap</div>
          <div className="stat-value font-mono">
            {formatUsdCompact(snapshot.totals.marketCap)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rankings */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Top Streaming Tokens</h2>
          <div className="space-y-3">
            {snapshot.tokens.map((token) => (
              <Link
                key={token.address}
                href={`/token/${token.address}`}
                className="block"
              >
                <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="card-body p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold opacity-50 w-8 text-center shrink-0">
                        {token.rank}
                      </div>
                      <div className="avatar shrink-0">
                        <div className="w-12 h-12 rounded-xl">
                          <SafeImage
                            src={token.img_url ?? undefined}
                            alt={token.name}
                            width={48}
                            height={48}
                            className="rounded-xl object-cover"
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold truncate">
                            {token.name}
                          </span>
                          <span className="text-sm opacity-60">
                            ${token.symbol}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {token.reasons.map((reason) => (
                            <span
                              key={reason}
                              className="badge badge-ghost badge-sm"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-semibold">
                          {formatPrice(token.price)}
                        </div>
                        {token.change24h === 0 && token.volume24h === 0 ? (
                          <div className="font-mono text-sm opacity-40">—</div>
                        ) : (
                          <div
                            className={`font-mono text-sm ${
                              token.change24h >= 0
                                ? "text-success"
                                : "text-error"
                            }`}
                          >
                            {formatPercentChange(token.change24h)}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 hidden sm:block w-24">
                        <div className="text-xs opacity-50">MCap</div>
                        <div className="font-mono text-sm">
                          {formatUsdCompact(token.marketCap)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {snapshot.tokens.length === 0 && (
              <div className="text-center py-12 opacity-60">
                No ranked tokens right now
              </div>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Milestones</h2>
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4 space-y-3">
                {milestones.length === 0 && (
                  <p className="text-sm opacity-60">
                    No milestones yet. When a token crosses a market cap
                    level, it shows up here — and the @streme bot celebrates
                    it onchain.
                  </p>
                )}
                {milestones.slice(0, 10).map((milestone) => (
                  <Link
                    key={milestone.id}
                    href={`/token/${milestone.tokenAddress}`}
                    className="block hover:bg-base-200 rounded-lg p-2 -m-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">
                        ${milestone.symbol}
                      </span>
                      <span className="badge badge-primary badge-sm shrink-0">
                        {formatUsdCompact(milestone.threshold)} mcap
                      </span>
                    </div>
                    <div className="text-xs opacity-50 mt-1">
                      {relativeTime(milestone.detectedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Bot Activity</h2>
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4 space-y-4">
                {casts.length === 0 && (
                  <p className="text-sm opacity-60">
                    The Pulse engine hasn&apos;t broadcast anything yet. Daily
                    pulse casts and milestone celebrations will appear here.
                  </p>
                )}
                {casts.slice(0, 8).map((cast) => (
                  <div key={cast.idem + cast.createdAt}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase opacity-60">
                        {cast.kind.replace("_", " ")}
                      </span>
                      <span
                        className={`badge badge-sm ${
                          CAST_STATUS_BADGES[cast.status]
                        }`}
                      >
                        {cast.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-line line-clamp-4 opacity-80">
                      {cast.text}
                    </p>
                    <div className="text-xs opacity-50 mt-1">
                      {relativeTime(cast.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs opacity-50 mt-12 max-w-2xl">
        This page is generated by the Streme Pulse engine: a transparent,
        automated ranking of every Streme token by volume, momentum,
        freshness, and staking activity. The same engine powers the @streme
        bot&apos;s automated casts — every broadcast it makes (or skips) is
        logged above.
      </p>
    </div>
  );
}
