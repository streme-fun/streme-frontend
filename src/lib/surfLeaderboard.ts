import { Redis } from "@upstash/redis";

export interface LeaderboardEntry {
  fid: number;
  username: string;
  pfpUrl: string;
  distance: number;
  bubbles: number;
  updatedAt: number;
}

export interface SubmitResult {
  best: number;
  rank: number; // 1-based
  total: number;
  improved: boolean;
}

// Use Redis if KV env vars are present, otherwise an in-memory fallback
// (mirrors src/lib/kv.ts). Dev writes are namespaced away from production.
const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

const ENV_SUFFIX = process.env.NODE_ENV === "production" ? "" : ":dev";
const BOARD_KEY = `streme-surf:leaderboard${ENV_SUFFIX}`;
const playerKey = (fid: number) => `streme-surf:player:${fid}${ENV_SUFFIX}`;

// In-memory fallback
const localBoard = new Map<number, LeaderboardEntry>();

function localRankOf(fid: number): { rank: number; total: number } {
  const sorted = [...localBoard.values()].sort(
    (a, b) => b.distance - a.distance
  );
  return {
    rank: sorted.findIndex((e) => e.fid === fid) + 1,
    total: sorted.length,
  };
}

export async function submitScore(
  entry: Omit<LeaderboardEntry, "updatedAt">
): Promise<SubmitResult> {
  const now = Date.now();
  if (redis) {
    const current = await redis.zscore(BOARD_KEY, String(entry.fid));
    const improved = current === null || entry.distance > Number(current);
    if (improved) {
      await redis.zadd(BOARD_KEY, {
        score: entry.distance,
        member: String(entry.fid),
      });
      await redis.hset(playerKey(entry.fid), { ...entry, updatedAt: now });
    } else {
      // Keep profile fresh even when the score doesn't improve
      await redis.hset(playerKey(entry.fid), {
        username: entry.username,
        pfpUrl: entry.pfpUrl,
      });
    }
    const [rank, total] = await Promise.all([
      redis.zrevrank(BOARD_KEY, String(entry.fid)),
      redis.zcard(BOARD_KEY),
    ]);
    return {
      best: improved ? entry.distance : Number(current),
      rank: (rank ?? 0) + 1,
      total,
      improved,
    };
  }

  const existing = localBoard.get(entry.fid);
  const improved = !existing || entry.distance > existing.distance;
  if (improved) {
    localBoard.set(entry.fid, { ...entry, updatedAt: now });
  }
  const { rank, total } = localRankOf(entry.fid);
  return {
    best: improved ? entry.distance : existing!.distance,
    rank,
    total,
    improved,
  };
}

export async function getLeaderboard(
  limit = 10,
  fid?: number
): Promise<{
  entries: LeaderboardEntry[];
  player: { rank: number; best: number } | null;
  total: number;
}> {
  if (redis) {
    const members = await redis.zrange<string[]>(BOARD_KEY, 0, limit - 1, {
      rev: true,
    });
    const entries: LeaderboardEntry[] = [];
    if (members.length > 0) {
      const pipeline = redis.pipeline();
      for (const member of members) {
        pipeline.hgetall(playerKey(Number(member)));
      }
      const rows = await pipeline.exec<(Record<string, unknown> | null)[]>();
      rows.forEach((row, i) => {
        if (row) {
          entries.push({
            fid: Number(members[i]),
            username: String(row.username ?? ""),
            pfpUrl: String(row.pfpUrl ?? ""),
            distance: Number(row.distance ?? 0),
            bubbles: Number(row.bubbles ?? 0),
            updatedAt: Number(row.updatedAt ?? 0),
          });
        }
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

  const sorted = [...localBoard.values()].sort(
    (a, b) => b.distance - a.distance
  );
  const entries = sorted.slice(0, limit);
  let player: { rank: number; best: number } | null = null;
  if (fid) {
    const idx = sorted.findIndex((e) => e.fid === fid);
    if (idx >= 0) player = { rank: idx + 1, best: sorted[idx].distance };
  }
  return { entries, player, total: sorted.length };
}
