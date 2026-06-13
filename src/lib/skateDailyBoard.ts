import { Redis } from "@upstash/redis";
import { prevDailyKey } from "./skateDaily";
import { FlairTier, isFlairTier } from "./skateFlair";

// DAILY LINE storage — a day-keyed leaderboard where each player may run the
// course as many times as they like within the 24h window and their BEST score
// is what stands on the board, plus play streaks and the run recordings
// ("rival ghosts" — the recording of your best run) for racing today's course.
// Mirrors src/lib/skateLeaderboard.ts: Redis when KV env vars exist, otherwise
// an in-memory fallback; dev writes are namespaced away from production.

export interface DailyEntry {
  fid: number;
  username: string;
  pfpUrl: string;
  score: number;
  combo: number;
  flair?: FlairTier | null; // $STREME crew badge, resolved server-side
  updatedAt: number;
  rank?: number; // 1-based, set on `nearby` entries (they sit off the top list)
}

export interface DailyStreak {
  count: number;
  best: number;
}

export interface DailySubmitResult {
  rank: number; // 1-based
  total: number;
  streak: DailyStreak;
  improved: boolean; // did this run beat your previous best today?
  best: number; // your best score now standing on today's board
}

export interface DailyGhostRecord {
  fid: number;
  username: string;
  score: number;
  flair?: FlairTier | null;
  samples: number[]; // flat [px,py] pairs, sampled every 0.15s by the engine
}

export interface DailyBoardData {
  played: boolean; // already have a score on today's board (best-so-far)
  me: { rank: number; score: number } | null;
  streak: DailyStreak;
  total: number;
  entries: DailyEntry[];
  nearby: DailyEntry[]; // micro-leaderboard around the player (when off the top list)
  ghosts: DailyGhostRecord[]; // rivals to race: leader + the players just above you
}

const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

const ENV_SUFFIX = process.env.NODE_ENV === "production" ? "" : ":dev";
const boardKey = (day: string) => `streme-skate:daily:${day}:board${ENV_SUFFIX}`;
const playerKey = (day: string, fid: number) =>
  `streme-skate:daily:${day}:player:${fid}${ENV_SUFFIX}`;
const ghostKey = (day: string, fid: number) =>
  `streme-skate:daily:${day}:ghost:${fid}${ENV_SUFFIX}`;
const streakKey = (fid: number) => `streme-skate:streak:${fid}${ENV_SUFFIX}`;

const BOARD_TTL = 35 * 24 * 3600; // keep past lines around for ~a month
const GHOST_TTL = 3 * 24 * 3600; // recordings are only raced on their own day
const MAX_SAMPLES = 1400;
const TOP_N = 10;

// ---------------------------------------------------------------- fallbacks

const localBoards = new Map<string, Map<number, DailyEntry>>();
const localGhosts = new Map<string, Map<number, DailyGhostRecord>>();
const localStreaks = new Map<number, DailyStreak & { lastDay: string }>();

function localBoard(day: string): Map<number, DailyEntry> {
  let b = localBoards.get(day);
  if (!b) {
    b = new Map();
    localBoards.set(day, b);
  }
  return b;
}

function sanitizeSamples(samples: number[]): number[] {
  return samples
    .slice(0, MAX_SAMPLES)
    .map((n) => (Number.isFinite(n) ? Math.round(n) : 0));
}

// ------------------------------------------------------------------ streaks

async function bumpStreak(fid: number, day: string): Promise<DailyStreak> {
  const yesterday = prevDailyKey(day);
  if (redis) {
    const cur = await redis.hgetall<Record<string, string | number>>(
      streakKey(fid)
    );
    const lastDay = String(cur?.lastDay ?? "");
    let count = Number(cur?.count ?? 0);
    const best = Number(cur?.best ?? 0);
    if (lastDay === day) return { count, best };
    count = lastDay === yesterday ? count + 1 : 1;
    const nextBest = Math.max(best, count);
    await redis.hset(streakKey(fid), { count, best: nextBest, lastDay: day });
    return { count, best: nextBest };
  }
  const cur = localStreaks.get(fid);
  if (cur?.lastDay === day) return { count: cur.count, best: cur.best };
  const count = cur?.lastDay === yesterday ? cur.count + 1 : 1;
  const best = Math.max(cur?.best ?? 0, count);
  localStreaks.set(fid, { count, best, lastDay: day });
  return { count, best };
}

async function getStreak(fid: number): Promise<DailyStreak> {
  if (redis) {
    const cur = await redis.hgetall<Record<string, string | number>>(
      streakKey(fid)
    );
    return { count: Number(cur?.count ?? 0), best: Number(cur?.best ?? 0) };
  }
  const cur = localStreaks.get(fid);
  return { count: cur?.count ?? 0, best: cur?.best ?? 0 };
}

// ------------------------------------------------------------------- submit

/**
 * Record one of the player's runs for the day. Tries are unlimited within the
 * 24h window; only an improvement on their previous best overwrites the board
 * score, profile, and rival ghost. Either way the play bumps the daily streak
 * (idempotent per day) and we return the standing of their best score.
 */
export async function submitDailyRun(
  day: string,
  entry: Omit<DailyEntry, "updatedAt">,
  samples: number[]
): Promise<DailySubmitResult> {
  const now = Date.now();
  const ghost: DailyGhostRecord = {
    fid: entry.fid,
    username: entry.username,
    score: entry.score,
    flair: entry.flair ?? null,
    samples: sanitizeSamples(samples),
  };

  if (redis) {
    const existing = await redis.zscore(boardKey(day), String(entry.fid));
    const prevBest = existing === null ? null : Number(existing);
    const improved = prevBest === null || entry.score > prevBest;

    if (improved) {
      await redis.zadd(boardKey(day), {
        score: entry.score,
        member: String(entry.fid),
      });
      await Promise.all([
        redis.expire(boardKey(day), BOARD_TTL),
        redis.hset(playerKey(day, entry.fid), {
          ...entry,
          flair: entry.flair ?? "",
          updatedAt: now,
        }),
        redis.expire(playerKey(day, entry.fid), BOARD_TTL),
        ghost.samples.length >= 8
          ? redis.set(ghostKey(day, entry.fid), JSON.stringify(ghost), {
              ex: GHOST_TTL,
            })
          : Promise.resolve(),
      ]);
    }
    const [rank, total, streak] = await Promise.all([
      redis.zrevrank(boardKey(day), String(entry.fid)),
      redis.zcard(boardKey(day)),
      bumpStreak(entry.fid, day),
    ]);
    return {
      rank: (rank ?? 0) + 1,
      total,
      streak,
      improved,
      best: improved ? entry.score : prevBest ?? entry.score,
    };
  }

  const board = localBoard(day);
  const prevBest = board.get(entry.fid)?.score ?? null;
  const improved = prevBest === null || entry.score > prevBest;
  if (improved) {
    board.set(entry.fid, { ...entry, updatedAt: now });
    if (ghost.samples.length >= 8) {
      let g = localGhosts.get(day);
      if (!g) {
        g = new Map();
        localGhosts.set(day, g);
      }
      g.set(entry.fid, ghost);
    }
  }
  const streak = await bumpStreak(entry.fid, day);
  const sorted = [...board.values()].sort((a, b) => b.score - a.score);
  return {
    rank: sorted.findIndex((e) => e.fid === entry.fid) + 1,
    total: sorted.length,
    streak,
    improved,
    best: improved ? entry.score : prevBest ?? entry.score,
  };
}

// --------------------------------------------------------------------- read

function entryFromRow(
  fid: number,
  score: number,
  row: Record<string, unknown> | null
): DailyEntry {
  return {
    fid,
    username: String(row?.username ?? ""),
    pfpUrl: String(row?.pfpUrl ?? ""),
    score,
    combo: Number(row?.combo ?? 0),
    flair: isFlairTier(row?.flair) ? row?.flair : null,
    updatedAt: Number(row?.updatedAt ?? 0),
  };
}

/**
 * Everything the client needs about today's line in one read: the top of the
 * board, the player's rank + a micro-leaderboard around them (proximal
 * comparison beats a distant global rank), their streak, and rival ghosts —
 * the leader plus the players ranked just above them (a closable gap).
 */
export async function getDailyBoard(
  day: string,
  fid?: number
): Promise<DailyBoardData> {
  if (redis) {
    const ranked = (await redis.zrange<(string | number)[]>(
      boardKey(day),
      0,
      TOP_N - 1,
      { rev: true, withScores: true }
    )) as (string | number)[];
    const top: { fid: number; score: number }[] = [];
    for (let i = 0; i < ranked.length; i += 2) {
      top.push({ fid: Number(ranked[i]), score: Number(ranked[i + 1]) });
    }

    const total = await redis.zcard(boardKey(day));
    let me: { rank: number; score: number } | null = null;
    const nearbyMembers: { fid: number; score: number; rank: number }[] = [];
    if (fid) {
      const [rank, score] = await Promise.all([
        redis.zrevrank(boardKey(day), String(fid)),
        redis.zscore(boardKey(day), String(fid)),
      ]);
      if (rank !== null && score !== null) {
        me = { rank: rank + 1, score: Number(score) };
        if (me.rank > TOP_N) {
          const start = Math.max(0, rank - 2);
          const around = (await redis.zrange<(string | number)[]>(
            boardKey(day),
            start,
            rank + 2,
            { rev: true, withScores: true }
          )) as (string | number)[];
          for (let i = 0; i < around.length; i += 2) {
            nearbyMembers.push({
              fid: Number(around[i]),
              score: Number(around[i + 1]),
              rank: start + i / 2 + 1,
            });
          }
        }
      }
    }

    // rivals to race: the leader + up to two players immediately above you
    let rivalFids: number[] = top.slice(0, 4).map((m) => m.fid);
    if (me && me.rank > 3) {
      const above = (await redis.zrange<string[]>(
        boardKey(day),
        Math.max(0, me.rank - 3),
        me.rank - 2,
        { rev: true }
      )) as string[];
      rivalFids = [top[0]?.fid, ...above.map(Number)].filter(
        (f): f is number => Number.isFinite(f)
      );
    }
    rivalFids = [...new Set(rivalFids)].filter((f) => f !== fid).slice(0, 4);

    const needProfiles = [...top, ...nearbyMembers];
    const profiles = new Map<number, Record<string, unknown> | null>();
    if (needProfiles.length > 0) {
      const pipeline = redis.pipeline();
      for (const m of needProfiles) pipeline.hgetall(playerKey(day, m.fid));
      const rows = await pipeline.exec<(Record<string, unknown> | null)[]>();
      needProfiles.forEach((m, i) => profiles.set(m.fid, rows[i] ?? null));
    }
    const entries = top.map((m) =>
      entryFromRow(m.fid, m.score, profiles.get(m.fid) ?? null)
    );
    const nearby = nearbyMembers.map((m) => ({
      ...entryFromRow(m.fid, m.score, profiles.get(m.fid) ?? null),
      rank: m.rank,
    }));

    const ghosts: DailyGhostRecord[] = [];
    if (rivalFids.length > 0) {
      const rows = await Promise.all(
        rivalFids.map((f) => redis.get(ghostKey(day, f)))
      );
      for (const row of rows) {
        if (!row) continue;
        try {
          const rec = typeof row === "string" ? JSON.parse(row) : row;
          if (rec && Array.isArray(rec.samples)) {
            ghosts.push(rec as DailyGhostRecord);
          }
        } catch {
          // skip malformed
        }
      }
    }

    return {
      played: me !== null,
      me,
      streak: fid ? await getStreak(fid) : { count: 0, best: 0 },
      total,
      entries,
      nearby,
      ghosts,
    };
  }

  const board = localBoard(day);
  const sorted = [...board.values()].sort((a, b) => b.score - a.score);
  const entries = sorted.slice(0, TOP_N);
  let me: { rank: number; score: number } | null = null;
  let nearby: DailyEntry[] = [];
  if (fid) {
    const idx = sorted.findIndex((e) => e.fid === fid);
    if (idx >= 0) {
      me = { rank: idx + 1, score: sorted[idx].score };
      if (me.rank > TOP_N) {
        const start = Math.max(0, idx - 2);
        nearby = sorted
          .slice(start, idx + 3)
          .map((e, i) => ({ ...e, rank: start + i + 1 }));
      }
    }
  }
  const ghostPool = localGhosts.get(day);
  let rivalFids = sorted.slice(0, 4).map((e) => e.fid);
  if (me && me.rank > 3) {
    rivalFids = [
      sorted[0].fid,
      ...sorted.slice(Math.max(0, me.rank - 3), me.rank - 1).map((e) => e.fid),
    ];
  }
  const ghosts = [...new Set(rivalFids)]
    .filter((f) => f !== fid)
    .slice(0, 4)
    .map((f) => ghostPool?.get(f))
    .filter((g): g is DailyGhostRecord => Boolean(g));

  return {
    played: me !== null,
    me,
    streak: fid ? await getStreak(fid) : { count: 0, best: 0 },
    total: sorted.length,
    entries,
    nearby,
    ghosts,
  };
}

