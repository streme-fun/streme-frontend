import { Redis } from "@upstash/redis";

export interface GhostRecord {
  fid: number;
  username: string;
  score: number;
  samples: number[]; // flat [px,py] pairs, sampled every 0.15s by the engine
}

const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

const ENV_SUFFIX = process.env.NODE_ENV === "production" ? "" : ":dev";
const BOARD_KEY = `streme-skate:ghosts${ENV_SUFFIX}`; // sorted set fid → score
const ghostKey = (fid: number) => `streme-skate:ghost:${fid}${ENV_SUFFIX}`;
const KEEP = 80; // cap how many ghost recordings we retain
const MAX_SAMPLES = 1400; // ~105s of run at 0.15s sampling

const local = new Map<number, GhostRecord>();

function sanitize(samples: number[]): number[] {
  return samples
    .slice(0, MAX_SAMPLES)
    .map((n) => (Number.isFinite(n) ? Math.round(n) : 0));
}

export async function saveGhost(g: GhostRecord): Promise<void> {
  const rec: GhostRecord = { ...g, samples: sanitize(g.samples) };
  if (rec.samples.length < 8) return; // too short to be a useful ghost

  if (redis) {
    const current = await redis.zscore(BOARD_KEY, String(rec.fid));
    if (current === null || rec.score > Number(current)) {
      await redis.zadd(BOARD_KEY, { score: rec.score, member: String(rec.fid) });
      await redis.set(ghostKey(rec.fid), JSON.stringify(rec));
      // trim to the best KEEP recordings
      const extra = await redis.zrange<string[]>(BOARD_KEY, 0, -KEEP - 1);
      if (extra.length) {
        await redis.zrem(BOARD_KEY, ...extra);
        await Promise.all(extra.map((fid) => redis.del(ghostKey(Number(fid)))));
      }
    }
    return;
  }

  const existing = local.get(rec.fid);
  if (!existing || rec.score > existing.score) local.set(rec.fid, rec);
}

export async function getGhosts(
  limit = 4,
  excludeFid?: number
): Promise<GhostRecord[]> {
  if (redis) {
    // pull a pool of the top runs, then take a varied slice
    const members = await redis.zrange<string[]>(BOARD_KEY, 0, limit + 6, {
      rev: true,
    });
    const fids = members
      .map(Number)
      .filter((fid) => fid !== excludeFid)
      .slice(0, limit);
    if (fids.length === 0) return [];
    const rows = await Promise.all(fids.map((fid) => redis.get(ghostKey(fid))));
    const out: GhostRecord[] = [];
    for (const row of rows) {
      if (!row) continue;
      try {
        const rec = typeof row === "string" ? JSON.parse(row) : row;
        if (rec && Array.isArray(rec.samples)) out.push(rec as GhostRecord);
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  return [...local.values()]
    .filter((g) => g.fid !== excludeFid)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
