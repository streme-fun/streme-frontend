import { Redis } from "@upstash/redis";
import { FlairTier, isFlairTier } from "./skateFlair";

export interface SkateEntry {
  fid: number;
  username: string;
  pfpUrl: string;
  score: number;
  combo: number; // best single combo of the run
  flair?: FlairTier | null; // $STREME crew badge, resolved server-side
  updatedAt: number;
}

export interface SkateSubmitResult {
  best: number;
  rank: number; // 1-based
  total: number;
  improved: boolean;
}

// Use Redis if KV env vars are present, otherwise an in-memory fallback
// (mirrors src/lib/surfLeaderboard.ts). Dev writes are namespaced away from
// production.
const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

const ENV_SUFFIX = process.env.NODE_ENV === "production" ? "" : ":dev";
const BOARD_KEY = `streme-skate:leaderboard${ENV_SUFFIX}`;
const playerKey = (fid: number) => `streme-skate:player:${fid}${ENV_SUFFIX}`;

// In-memory fallback
const localBoard = new Map<number, SkateEntry>();

function localRankOf(fid: number): { rank: number; total: number } {
  const sorted = [...localBoard.values()].sort((a, b) => b.score - a.score);
  return {
    rank: sorted.findIndex((e) => e.fid === fid) + 1,
    total: sorted.length,
  };
}

export async function submitSkateScore(
  entry: Omit<SkateEntry, "updatedAt">
): Promise<SkateSubmitResult> {
  const now = Date.now();
  if (redis) {
    const current = await redis.zscore(BOARD_KEY, String(entry.fid));
    const improved = current === null || entry.score > Number(current);
    if (improved) {
      await redis.zadd(BOARD_KEY, {
        score: entry.score,
        member: String(entry.fid),
      });
      await redis.hset(playerKey(entry.fid), {
        ...entry,
        flair: entry.flair ?? "",
        updatedAt: now,
      });
    } else {
      // Keep the profile fresh even when the score doesn't improve — but never
      // blank out good data: a run can arrive with an empty username/pfp (e.g.
      // the Warplet image didn't resolve), and overwriting with "" would make a
      // ranked player render nameless/avatarless ("disappear"). Flair is the
      // exception: it's server-derived truth, so always write it — a player who
      // sold down SHOULD lose the badge on their next run.
      const profile: Record<string, string> = {
        flair: entry.flair ?? "",
      };
      if (entry.username) profile.username = entry.username;
      if (entry.pfpUrl) profile.pfpUrl = entry.pfpUrl;
      await redis.hset(playerKey(entry.fid), profile);
    }
    const [rank, total] = await Promise.all([
      redis.zrevrank(BOARD_KEY, String(entry.fid)),
      redis.zcard(BOARD_KEY),
    ]);
    return {
      best: improved ? entry.score : Number(current),
      rank: (rank ?? 0) + 1,
      total,
      improved,
    };
  }

  const existing = localBoard.get(entry.fid);
  const improved = !existing || entry.score > existing.score;
  if (improved) {
    localBoard.set(entry.fid, { ...entry, updatedAt: now });
  }
  const { rank, total } = localRankOf(entry.fid);
  return {
    best: improved ? entry.score : existing!.score,
    rank,
    total,
    improved,
  };
}

export async function getSkateLeaderboard(
  limit = 25,
  fid?: number
): Promise<{
  entries: SkateEntry[];
  player: { rank: number; best: number } | null;
  total: number;
}> {
  if (redis) {
    // Pull members WITH their sorted-set scores. The zset is the source of truth
    // for both ranking and the displayed score, so a missing/stale profile hash
    // can never drop a ranked player off the board (the old code skipped any
    // member whose hgetall came back empty, leaving gaps).
    const ranked = (await redis.zrange<(string | number)[]>(
      BOARD_KEY,
      0,
      limit - 1,
      { rev: true, withScores: true }
    )) as (string | number)[];
    const members: { fid: number; score: number }[] = [];
    for (let i = 0; i < ranked.length; i += 2) {
      members.push({ fid: Number(ranked[i]), score: Number(ranked[i + 1]) });
    }
    const entries: SkateEntry[] = [];
    if (members.length > 0) {
      const pipeline = redis.pipeline();
      for (const m of members) {
        pipeline.hgetall(playerKey(m.fid));
      }
      const rows = await pipeline.exec<(Record<string, unknown> | null)[]>();
      members.forEach((m, i) => {
        const row = rows[i] ?? {};
        entries.push({
          fid: m.fid,
          username: String(row.username ?? ""),
          pfpUrl: String(row.pfpUrl ?? ""),
          score: m.score, // zset score is authoritative
          combo: Number(row.combo ?? 0),
          flair: isFlairTier(row.flair) ? row.flair : null,
          updatedAt: Number(row.updatedAt ?? 0),
        });
      });
    }
    const total = await redis.zcard(BOARD_KEY);
    let player: { rank: number; best: number } | null = null;
    if (fid) {
      const [rank, best] = await Promise.all([
        redis.zrevrank(BOARD_KEY, String(fid)),
        redis.zscore(BOARD_KEY, String(fid)),
      ]);
      if (rank !== null && best !== null) {
        player = { rank: rank + 1, best: Number(best) };
      }
    }
    return { entries, player, total };
  }

  const sorted = [...localBoard.values()].sort((a, b) => b.score - a.score);
  const entries = sorted.slice(0, limit);
  let player: { rank: number; best: number } | null = null;
  if (fid) {
    const idx = sorted.findIndex((e) => e.fid === fid);
    if (idx >= 0) player = { rank: idx + 1, best: sorted[idx].score };
  }
  return { entries, player, total: sorted.length };
}
