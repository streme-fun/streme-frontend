"use client";

// Headline counters for the Agent Floor — chain-verified numbers only
// (plan U5). These are discrete counts, not flow rates, so there is no
// faked per-second motion: values ease to their new total when a poll
// brings fresh data, and that's it.
//
// Cold start renders an em-dash in every value slot (never a bare 0) while
// keeping the titles visible — the floor looks ready, not embarrassing.

import { useEffect, useRef, useState } from "react";
import type { FloorCountersShape } from "./types";

/** Ease the displayed number toward `target` whenever it changes. */
function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}

function formatEth(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 100) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString();
}

interface StatProps {
  title: string;
  value: number;
  format: (value: number) => string;
  coldStart: boolean;
  /** Secondary line under the value (e.g. the Resident volume split) */
  desc?: string;
  valueClassName?: string;
}

function AnimatedStat({
  title,
  value,
  format,
  coldStart,
  desc,
  valueClassName = "",
}: StatProps) {
  const animated = useCountUp(value);
  return (
    <div className="stat">
      <div className="stat-title">{title}</div>
      <div className={`stat-value font-mono text-2xl sm:text-3xl ${valueClassName}`}>
        {coldStart ? "—" : format(animated)}
      </div>
      {desc && <div className="stat-desc">{desc}</div>}
    </div>
  );
}

interface FloorCountersProps {
  today: FloorCountersShape;
  yesterday: FloorCountersShape;
  coldStart: boolean;
}

export default function FloorCounters({
  today,
  yesterday,
  coldStart,
}: FloorCountersProps) {
  // Verified counters reset at UTC midnight; when today is still empty but
  // yesterday wasn't, say so instead of looking dead.
  const yesterdayNote = (todayValue: number, yesterdayValue: number, fmt: (v: number) => string) =>
    !coldStart && todayValue === 0 && yesterdayValue > 0
      ? `yesterday: ${fmt(yesterdayValue)}`
      : "today (UTC)";

  // Streams are structurally zero at launch — render the counter only once
  // one exists (plan U5 review refinement).
  const showStreams = today.streamsOpened > 0 || yesterday.streamsOpened > 0;

  return (
    <div className="stats stats-vertical sm:stats-horizontal shadow w-full mb-8 bg-base-100">
      <AnimatedStat
        title="Agent Volume (ETH)"
        value={today.volumeEthExternal}
        format={formatEth}
        coldStart={coldStart}
        valueClassName="text-primary"
        desc={
          !coldStart && today.volumeEthResident > 0
            ? `Resident: ${formatEth(today.volumeEthResident)} ETH`
            : yesterdayNote(
                today.volumeEthExternal,
                yesterday.volumeEthExternal,
                formatEth
              )
        }
      />
      <AnimatedStat
        title="Active Agent Wallets"
        value={today.activeAgentWallets}
        format={formatCount}
        coldStart={coldStart}
        desc={yesterdayNote(
          today.activeAgentWallets,
          yesterday.activeAgentWallets,
          formatCount
        )}
      />
      <AnimatedStat
        title="Stakes"
        value={today.stakes}
        format={formatCount}
        coldStart={coldStart}
        desc={yesterdayNote(today.stakes, yesterday.stakes, formatCount)}
      />
      {showStreams && (
        <AnimatedStat
          title="Streams Opened"
          value={today.streamsOpened}
          format={formatCount}
          coldStart={coldStart}
          desc={yesterdayNote(
            today.streamsOpened,
            yesterday.streamsOpened,
            formatCount
          )}
        />
      )}
    </div>
  );
}
