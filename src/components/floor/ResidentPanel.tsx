"use client";

// The Resident panel — ALWAYS the first content block on the Agent Floor,
// in every state (loading, error, cold start, live). The card, its slot,
// and its props seam are the U5 layout contract; U8 fills the internals:
//
//   1. Identity strip — name, Streme-operated badge, Basescan-linked
//      address, live status dot.
//   2. Position row — ETH balance, incoming yield (USD degrades to "price
//      unavailable" on stale market data — never $NaN/$0.00 claims),
//      active streams, spent-today ledger readout.
//   3. Decision journal — the page's narrative centerpiece. Entries are
//      write-time sanitized plain text; rendered defensively anyway
//      (plain text nodes, no markup parsing).
//
// Halted is a state, not an absence (origin R14): the full panel renders
// with a prominent warning banner and the journal stays visible.
//
// Yield animation note: the per-second counter is a literal "earned since
// you opened this page" accumulator (usdPerDay / 86400 per second from
// zero at mount) next to the static daily rate — the simplest honest
// presentation; it never claims lifetime P&L.

import { useState } from "react";
import { useStreamingNumber } from "@/src/hooks/useStreamingNumber";
import type {
  ResidentJournalEntry,
  ResidentJournalState,
} from "@/src/lib/resident/journal";
import type { FloorSnapshot } from "./types";
import { relativeTime, truncateHex } from "./format";

const STATE_META: Record<
  ResidentJournalState,
  { label: string; badgeClass: string }
> = {
  intended: { label: "intended", badgeClass: "badge-info" },
  broadcast: { label: "broadcast", badgeClass: "badge-info animate-pulse" },
  confirmed: { label: "confirmed", badgeClass: "badge-success" },
  failed: { label: "failed", badgeClass: "badge-error" },
  skipped: { label: "skipped", badgeClass: "badge-ghost" },
  halted: { label: "halted", badgeClass: "badge-warning" },
};

/** "0.0200" → "0.02", "1.0000" → "1"; non-finite → null. */
function formatEthAmount(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  return parseFloat(value.toFixed(4)).toString();
}

function JournalEntryCard({ entry }: { entry: ResidentJournalEntry }) {
  const meta = STATE_META[entry.state] ?? {
    label: entry.state,
    badgeClass: "badge-ghost",
  };
  return (
    <div className="rounded-lg bg-base-100 border border-base-300 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge badge-sm ${meta.badgeClass}`}>
          {meta.label}
        </span>
        {entry.dryRun && (
          <span className="badge badge-sm badge-outline">dry run</span>
        )}
        {entry.action && (
          <span className="text-xs font-mono opacity-70">
            {entry.action.kind}
            {entry.action.ethAmount ? ` ${entry.action.ethAmount} ETH` : ""}
            {entry.action.amount ? ` ${entry.action.amount}` : ""}
            {" · "}
            {truncateHex(entry.action.token)}
          </span>
        )}
        <span className="text-xs opacity-50 ml-auto shrink-0">
          {relativeTime(entry.at)}
        </span>
      </div>
      {/* Sanitized at write time; rendered as a plain text node regardless
          (React escaping, whitespace-pre-line — no markup interpretation). */}
      <p className="text-sm opacity-90 whitespace-pre-line mt-1.5">
        {entry.reasoning}
      </p>
      {entry.error && (
        <p className="text-xs text-error whitespace-pre-line mt-1">
          {entry.error}
        </p>
      )}
      {entry.txHash && (
        <a
          href={`https://basescan.org/tx/${entry.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-hover text-xs font-mono opacity-70 mt-1 inline-block"
        >
          tx {truncateHex(entry.txHash)} ↗
        </a>
      )}
    </div>
  );
}

interface ResidentPanelProps {
  /** Resident section from the floor snapshot; null until configured. */
  resident?: FloorSnapshot["resident"];
}

export default function ResidentPanel({ resident }: ResidentPanelProps) {
  // Mount time anchors the "earned since you opened this page" counter.
  const [loadedAt] = useState(() => Date.now());

  const usdPerDay = resident?.yield?.totalUsdPerDay;
  const hasUsdRate =
    typeof usdPerDay === "number" &&
    Number.isFinite(usdPerDay) &&
    usdPerDay > 0;

  const earnedSinceLoad = useStreamingNumber({
    baseAmount: 0,
    flowRatePerSecond: hasUsdRate ? usdPerDay / 86400 : 0,
    lastUpdateTime: loadedAt,
  });

  // No RESIDENT_ADDRESS configured server-side → honest placeholder. The
  // card itself still renders: the slot never collapses.
  if (!resident) {
    return (
      <div className="card bg-base-200 border border-base-300 mb-8">
        <div className="card-body p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="card-title text-lg">The Resident</h2>
            <span className="badge badge-ghost badge-sm">Streme-operated</span>
          </div>
          <p className="text-sm opacity-70 max-w-2xl">
            Streme&apos;s house agent. It trades through the same public
            gateway as every other agent — its own wallet, hard spend caps, a
            public decision journal, and live P&amp;L will appear right here.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning" />
            </span>
            <span className="text-sm font-mono opacity-70">coming online</span>
          </div>
        </div>
      </div>
    );
  }

  const halted = resident.halted === true;
  const ethBalance =
    resident.ethBalance !== null
      ? formatEthAmount(Number(resident.ethBalance))
      : null;
  const spentToday =
    resident.spentTodayEth !== null
      ? formatEthAmount(resident.spentTodayEth)
      : null;

  return (
    <div className="card bg-base-200 border border-base-300 mb-8">
      <div className="card-body p-5 sm:p-6 gap-4">
        {halted && (
          <div role="alert" className="alert alert-warning">
            <span>The Resident is halted — a human is looking at it.</span>
          </div>
        )}

        {/* Identity strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="card-title text-lg">The Resident</h2>
          <span className="badge badge-ghost badge-sm">Streme-operated</span>
          <a
            href={`https://basescan.org/address/${resident.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-hover text-xs font-mono opacity-70"
          >
            {truncateHex(resident.address)}
          </a>
          <span className="flex items-center gap-2">
            {halted ? (
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-warning" />
            ) : (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
            )}
            <span className="text-xs font-mono opacity-70">
              {halted ? "halted" : "live"}
            </span>
          </span>
        </div>

        {/* Position row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-xs opacity-60">ETH balance</div>
            <div className="font-mono text-sm">
              {ethBalance !== null ? `${ethBalance} ETH` : "unavailable"}
            </div>
          </div>
          <div>
            <div className="text-xs opacity-60">Incoming yield</div>
            {hasUsdRate ? (
              <>
                <div className="font-mono text-sm">
                  ${usdPerDay.toFixed(2)}/day
                </div>
                <div className="font-mono text-[11px] opacity-60">
                  +${earnedSinceLoad.toFixed(6)} earned since you opened this
                  page
                </div>
              </>
            ) : (
              <div className="text-sm opacity-70">price unavailable</div>
            )}
          </div>
          <div>
            <div className="text-xs opacity-60">Active streams</div>
            <div className="font-mono text-sm">
              {resident.yield !== null ? resident.yield.activeStreams : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs opacity-60">Spent today</div>
            <div className="font-mono text-sm">
              {spentToday !== null ? `${spentToday} ETH` : "—"}
            </div>
          </div>
        </div>

        {/* Decision journal — origin R12: always visible, even halted */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Decision journal</h3>
          {resident.journal === null ? (
            <p className="text-sm opacity-70">
              Journal temporarily unavailable — retrying with the next
              refresh.
            </p>
          ) : resident.journal.length === 0 ? (
            <p className="text-sm opacity-70">
              No decisions yet — first run pending.
            </p>
          ) : (
            <div className="space-y-2">
              {resident.journal.map((entry) => (
                <JournalEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
