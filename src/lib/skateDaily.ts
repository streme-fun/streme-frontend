// Shared (client + server + OG card) helpers for the DAILY LINE — the
// date-keyed, fixed-seed daily run. Everything here is a pure function of the
// UTC date, so every player, the API, and the share card all agree on which
// day it is, what its course seed is, and what the line is called.

/** The fixed seed free skate has always used — kept so ghosts stay aligned. */
export const FREE_SKATE_SEED = 20240611;

/** UTC day key, e.g. "2026-06-12". The line resets at midnight UTC. */
export function dailyKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isDailyKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** 31-bit course seed from the day key (FNV-1a) — feeds the engine RNG. */
export function dailySeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1; // 31-bit, never zero
}

// One name per weekday — the watercooler handle for today's line ("did you
// run THURSDAY THRASHER yet?"), stable for everyone in every timezone.
const LINE_NAMES = [
  "SUNDAY SHRED",
  "MONDAY MELTDOWN",
  "TUESDAY TECHSLIDE",
  "WEDNESDAY WHIPLASH",
  "THURSDAY THRASHER",
  "FRIDAY FAKIE",
  "SATURDAY SLAPPY",
];

export function dailyName(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  const day = d.getUTCDay();
  return Number.isFinite(day) ? LINE_NAMES[day] : "DAILY LINE";
}

/** Epoch ms when this day's line closes (next midnight UTC). */
export function dailyEndsAt(key: string): number {
  return new Date(`${key}T00:00:00Z`).getTime() + 24 * 3600 * 1000;
}

export function prevDailyKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "JUN 12" — compact date label for cards and headers. */
export function formatDailyDate(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  return d
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

/** "7h 12m" until the line resets (clamped at 0). */
export function formatTimeLeft(endsAt: number, now: number = Date.now()): string {
  const ms = Math.max(0, endsAt - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
