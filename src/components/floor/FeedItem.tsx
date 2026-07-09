// One Agent Floor feed event (plan U5).
//
// Display rules carried from the plan:
//  - tier 1/2 → "gateway-verified" badge; tier 3 → subtle "unverified
//    watermark" badge (R20). Badge text is always visible — no hover-only
//    information (mini-app has no hover).
//  - agentId is the primary label but always self-declared-labeled, with the
//    wallet visible beneath (R21); wallet-only when no agentId.
//  - stake_refunded is a refund, never presented as a stake.
//  - source "floor-ui" events are human copy-trades — labeled and visually
//    distinct from agent activity.
//
// `copySlot` is the U6 seam: the copy-trade button injects there without
// restructuring this component.

import type { ReactNode } from "react";
import type { FloorEvent } from "@/src/lib/floor/store";
import { relativeTime, truncateHex } from "./format";

const KIND_META: Record<
  FloorEvent["kind"],
  { label: string; badgeClass: string }
> = {
  buy: { label: "Buy", badgeClass: "badge-success" },
  stake: { label: "Stake", badgeClass: "badge-primary" },
  stake_refunded: { label: "Stake refunded", badgeClass: "badge-warning" },
  unstake: { label: "Unstake", badgeClass: "badge-neutral" },
  stream: { label: "Stream opened", badgeClass: "badge-info" },
  connect: { label: "Pool connect", badgeClass: "badge-accent" },
};

interface FeedItemProps {
  event: FloorEvent;
  /** U6 seam — the copy-trade control renders here when provided. */
  copySlot?: ReactNode;
}

export default function FeedItem({ event, copySlot }: FeedItemProps) {
  const kind = KIND_META[event.kind] ?? {
    label: event.kind,
    badgeClass: "badge-ghost",
  };
  const isHumanCopy = event.source === "floor-ui";
  const gatewayVerified = event.tier === 1 || event.tier === 2;

  return (
    <div
      className={`card shadow-sm ${
        isHumanCopy
          ? "bg-base-200 border border-info/40"
          : "bg-base-100"
      }`}
    >
      <div className="card-body p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge badge-sm ${kind.badgeClass}`}>
            {kind.label}
          </span>
          {gatewayVerified ? (
            <span className="badge badge-sm badge-outline badge-success">
              gateway-verified
            </span>
          ) : (
            <span className="badge badge-sm badge-ghost opacity-70">
              unverified watermark
            </span>
          )}
          {isHumanCopy && (
            <span className="badge badge-sm badge-info">
              copied by a human
            </span>
          )}
          <span className="text-xs opacity-50 ml-auto shrink-0">
            {relativeTime(event.at)}
          </span>
        </div>

        <p className="text-sm opacity-90">{event.description}</p>

        <div className="flex flex-wrap items-end justify-between gap-2">
          {event.agentId ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">
                  {event.agentId}
                </span>
                <span className="badge badge-ghost badge-xs shrink-0">
                  self-declared
                </span>
              </div>
              <div className="text-xs font-mono opacity-60">
                {truncateHex(event.wallet)}
              </div>
            </div>
          ) : (
            <span className="text-sm font-mono opacity-70">
              {truncateHex(event.wallet)}
            </span>
          )}
          {copySlot}
        </div>
      </div>
    </div>
  );
}
