// Shared shapes for the Agent Floor snapshot (`/api/agents/floor`) and the
// components that render it. Types only — safe to import from both the
// server route and client components.

import type { FloorEvent } from "@/src/lib/floor/store";
import type { ResidentJournalEntry } from "@/src/lib/resident/journal";

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
  /**
   * Resident section (plan U8) — null when RESIDENT_ADDRESS is unset.
   * Individual fields degrade to null on store/RPC failure, never a 500.
   */
  resident: ResidentSection | null;
  /** Epoch ms when this snapshot was generated */
  generatedAt: number;
}

/** Incoming-yield slice of the Resident section (subset of AccountYield). */
export interface ResidentYieldShape {
  /**
   * USD/day over flows with a known price. May be 0/unreliable when
   * upstream market data is stale — the CLIENT degrades the display
   * ("price unavailable"), never claims $0.00.
   */
  totalUsdPerDay: number;
  /** Number of active reward streams */
  activeStreams: number;
}

/**
 * The Resident's public state (plan U8). Every nullable field is a
 * per-field degradation: a failed store/RPC read nulls that field only.
 */
export interface ResidentSection {
  /** The Resident's wallet address, lowercased */
  address: string;
  /** Kill-switch flag; null when the store read failed */
  halted: boolean | null;
  /** Decision journal, newest first (write-time sanitized plain text) */
  journal: ResidentJournalEntry[] | null;
  yield: ResidentYieldShape | null;
  /** ETH balance as a decimal string (formatEther) */
  ethBalance: string | null;
  /** ETH committed today per the spend ledger (caps only, not P&L) */
  spentTodayEth: number | null;
  /**
   * Chain-verified floor events from the Resident's wallet — the
   * grounded P&L inputs (the spend ledger above is for caps only).
   */
  verifiedEvents: FloorEvent[];
}
