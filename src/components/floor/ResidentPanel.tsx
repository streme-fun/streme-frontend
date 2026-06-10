// The Resident panel — ALWAYS the first content block on the Agent Floor,
// in every state (loading, error, cold start, live). Phase C (plan U7/U8)
// replaces the internals with the live position, P&L, and decision journal;
// the card itself, its slot, and its props seam must not move.

import type { FloorSnapshot } from "./types";

interface ResidentPanelProps {
  /**
   * Resident section from the floor snapshot. Null until Phase C ships —
   * the prop exists now so FloorContent's wiring doesn't change later.
   */
  resident?: FloorSnapshot["resident"];
}

export default function ResidentPanel({ resident }: ResidentPanelProps) {
  // Phase C renders position/journal/P&L from `resident`; until then the
  // section is null and this card is an honest "coming online" placeholder.
  void resident;
  return (
    <div className="card bg-base-200 border border-base-300 mb-8">
      <div className="card-body p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="card-title text-lg">The Resident</h2>
          <span className="badge badge-ghost badge-sm">Streme-operated</span>
        </div>
        <p className="text-sm opacity-70 max-w-2xl">
          Streme&apos;s house agent. It trades through the same public gateway
          as every other agent — its own wallet, hard spend caps, a public
          decision journal, and live P&amp;L will appear right here.
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
