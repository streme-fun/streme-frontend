// Shared shapes for the Agent Floor snapshot (`/api/agents/floor`) and the
// components that render it. Types only — safe to import from both the
// server route and client components.

import type { FloorEvent } from "@/src/lib/floor/store";

/** Verified daily counters shaped for display (plan U5). */
export interface FloorCountersShape {
  /** UTC date key ("YYYY-MM-DD") the counters cover */
  date: string;
  /** Chain-verified agent buy volume in ETH, external agents only */
  volumeEthExternal: number;
  /** Chain-verified buy volume in ETH attributed to the Resident */
  volumeEthResident: number;
  /** Distinct wallets behind verified agent events */
  activeAgentWallets: number;
  buys: number;
  stakes: number;
  unstakes: number;
  connects: number;
  streamsOpened: number;
}

/** Full snapshot payload served by GET /api/agents/floor. */
export interface FloorSnapshot {
  /** Most recent chain-verified events, newest first (blacklist-filtered) */
  events: FloorEvent[];
  counters: {
    today: FloorCountersShape;
    yesterday: FloorCountersShape;
  };
  /**
   * Best-effort stats. Tool calls are authless self-reports — explicitly
   * unverified, never a headline number (plan: chain-verified headlines only).
   */
  secondary: {
    unverifiedToolCallsToday: number;
  };
  /** True when the floor has no events or all counters are zero */
  coldStart: boolean;
  /** Resident section — null until Phase C fills it (key shaped now) */
  resident: null;
  /** Epoch ms when this snapshot was generated */
  generatedAt: number;
}
