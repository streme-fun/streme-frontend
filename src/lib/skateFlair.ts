// CREW FLAIR — status badges earned by holding/staking $STREME, rendered next
// to names on the skate leaderboards, on rival ghosts, and on share cards.
// Flair is pure identity: it never changes scoring, physics, or who you race.
//
// Tiers (resolved server-side from the FID's own verified wallets):
//   deck      — holds OR stakes ≥ 1M  $STREME (the entry rung, ~a dollar)
//   sponsored — stakes ≥ 10M $STREME (same bar as the Warplet skin gate)
//   pro       — stakes ≥ 100M $STREME
// Held balance only ever qualifies for DECK; the upper tiers require staking,
// so the badge signals commitment that can't be dumped mid-leaderboard.
//
// This file is imported by client components and the edge OG route — keep it
// pure constants/types (no Redis, no Neynar, no viem).

export type FlairTier = "deck" | "sponsored" | "pro";

export function isFlairTier(v: unknown): v is FlairTier {
  return v === "deck" || v === "sponsored" || v === "pro";
}

export const FLAIR_META: Record<
  FlairTier,
  {
    icon: string;
    label: string;
    hint: string; // tooltip — tells non-holders what the badge means
    chipClassName: string; // pill style (Tailwind) for in-game UI
    color: string; // hex for the OG share card pill
  }
> = {
  deck: {
    icon: "🛹",
    label: "DECK",
    hint: "DECK crew — holds 1M+ $STREME",
    chipClassName: "bg-cyan-400/15 text-cyan-600",
    color: "#22d3ee",
  },
  sponsored: {
    icon: "⚡",
    label: "SPONSORED",
    hint: "SPONSORED — 10M+ $STREME staked",
    chipClassName: "bg-violet-400/15 text-violet-600",
    color: "#a78bfa",
  },
  pro: {
    icon: "👑",
    label: "PRO",
    hint: "PRO — 100M+ $STREME staked",
    chipClassName: "bg-amber-400/15 text-amber-600",
    color: "#fbbf24",
  },
};
