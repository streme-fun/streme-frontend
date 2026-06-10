// The Resident's public decision journal — a state machine on the floor
// store's Redis (plan U7 / Key Technical Decision: "Journal entries are a
// state machine").
//
//   intended → broadcast(txHash) → confirmed | failed
//   terminal: skipped (guardrail rejection), halted (operator-visible crash
//   or kill switch)
//
// The journal write happens BEFORE broadcast; if the write fails, nothing is
// broadcast (the push helper propagates store errors — it is deliberately
// not fire-and-forget). Reasoning text comes from an LLM fed untrusted
// market data, so it is sanitized AT WRITE TIME: HTML tags and control
// characters stripped, length capped — the UI never has to trust it.

import {
  residentJournalList,
  residentJournalPush,
  residentJournalSet,
  RESIDENT_JOURNAL_CAP,
} from "@/src/lib/floor/store";

export type ResidentJournalState =
  | "intended"
  | "broadcast"
  | "confirmed"
  | "failed"
  | "skipped"
  | "halted";

/** States that need no further reconciliation. */
export const TERMINAL_JOURNAL_STATES: ResidentJournalState[] = [
  "confirmed",
  "failed",
  "skipped",
  "halted",
];

export type ResidentActionKind = "buy" | "stake" | "connect";

export interface ResidentJournalAction {
  kind: ResidentActionKind;
  token: string;
  /** Decimal ETH string (buys) */
  ethAmount?: string;
  /** Decimal token amount string (stakes) */
  amount?: string;
}

export interface ResidentJournalEntry {
  id: string;
  /** Epoch ms when the entry was first written */
  at: number;
  state: ResidentJournalState;
  action?: ResidentJournalAction;
  /** PLAIN TEXT — sanitized at write time, capped length */
  reasoning: string;
  txHash?: string;
  error?: string;
  /** Present (true) on entries written by a dry run — never broadcast */
  dryRun?: boolean;
}

export const REASONING_MAX_CHARS = 600;

/**
 * Write-time sanitization for journal text: strip HTML tags, strip control
 * characters, collapse whitespace, cap length. The LLM's reasoning quotes
 * untrusted token names/pulse reasons, so nothing markup-shaped survives.
 */
export function sanitizeReasoning(text: string): string {
  return (
    text
      .replace(/<[^>]*>/g, " ")
      // strip any leftover angle brackets from unterminated tags
      .replace(/[<>]/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, REASONING_MAX_CHARS)
  );
}

/** Unique journal entry id. */
export function newJournalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Test seam: force journalAppend to fail so the engine's
// journal-before-broadcast abort path is testable (the in-memory store
// cannot fail organically).
let failWritesForTests = false;

export function __setJournalWriteFailureForTests(fail: boolean): void {
  failWritesForTests = fail;
}

function sanitizeEntry(entry: ResidentJournalEntry): ResidentJournalEntry {
  return {
    ...entry,
    reasoning: sanitizeReasoning(entry.reasoning),
    error: entry.error !== undefined ? sanitizeReasoning(entry.error) : undefined,
  };
}

/**
 * Append a journal entry (newest first, capped list). Sanitizes text fields
 * at write. THROWS on store failure — callers must not broadcast after a
 * failed append.
 */
export async function journalAppend(
  entry: ResidentJournalEntry
): Promise<ResidentJournalEntry> {
  if (failWritesForTests) {
    throw new Error("journal write failed (forced by test seam)");
  }
  const sanitized = sanitizeEntry(entry);
  await residentJournalPush(JSON.stringify(sanitized));
  return sanitized;
}

function parseEntry(raw: unknown): ResidentJournalEntry | null {
  try {
    // Upstash may auto-deserialize JSON list values; the in-memory path
    // always stores strings. Tolerate both (same as the floor store reads).
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      value &&
      typeof value === "object" &&
      typeof (value as ResidentJournalEntry).id === "string" &&
      typeof (value as ResidentJournalEntry).state === "string"
    ) {
      return value as ResidentJournalEntry;
    }
  } catch {
    // Malformed entry — drop it rather than failing the whole read.
  }
  return null;
}

/**
 * Update one entry's state (and optional fields) in place. Read-modify-write
 * by list index is safe here: the engine is the journal's single writer and
 * only runs under the "resident" lock. Returns the updated entry, or null
 * when the id is no longer in the capped window.
 */
export async function journalUpdateState(
  id: string,
  state: ResidentJournalState,
  fields: Partial<
    Pick<ResidentJournalEntry, "txHash" | "error" | "reasoning">
  > = {}
): Promise<ResidentJournalEntry | null> {
  const raw = await residentJournalList(RESIDENT_JOURNAL_CAP);
  for (let index = 0; index < raw.length; index++) {
    const entry = parseEntry(raw[index]);
    if (!entry || entry.id !== id) continue;
    const updated = sanitizeEntry({ ...entry, ...fields, state });
    await residentJournalSet(index, JSON.stringify(updated));
    return updated;
  }
  return null;
}

/** Most recent journal entries, newest first. */
export async function getJournal(
  limit = 50
): Promise<ResidentJournalEntry[]> {
  const raw = await residentJournalList(Math.min(limit, RESIDENT_JOURNAL_CAP));
  return raw
    .map(parseEntry)
    .filter((entry): entry is ResidentJournalEntry => entry !== null);
}
