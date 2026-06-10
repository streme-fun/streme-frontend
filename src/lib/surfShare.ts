export interface SurfChallenge {
  distance: number;
  by?: string;
  rank?: number;
}

export interface SurfRankResult {
  best: number;
  rank: number;
  total: number;
  improved: boolean;
}

export const SURF_SHARE_URL = "https://streme.fun/surf";
export const SURF_DISPLAY_URL = "streme.fun/surf";

interface BuildSurfShareInput {
  distance: number;
  bubbles: number;
  username?: string;
  rankResult?: SurfRankResult | null;
  challenge?: SurfChallenge | null;
  challengeBeaten?: boolean;
  baseShareUrl?: string;
}

interface SurfShareIntent {
  shareUrl: string;
  castText: string;
}

const USERNAME_RE = /^[a-z0-9_.-]{1,32}$/i;
const MAX_SHARE_DISTANCE = 1_000_000;

function normalizedDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return Math.min(Math.max(Math.floor(distance), 0), MAX_SHARE_DISTANCE);
}

function normalizedBubbles(bubbles: number): number {
  if (!Number.isFinite(bubbles)) return 0;
  return Math.max(Math.floor(bubbles), 0);
}

function normalizedUsername(username?: string): string | undefined {
  return username && USERNAME_RE.test(username) ? username : undefined;
}

function rankAppliesToDistance(
  rankResult: SurfRankResult | null | undefined,
  distance: number
): rankResult is SurfRankResult {
  return Boolean(rankResult && normalizedDistance(rankResult.best) === distance);
}

export function buildSurfShareIntent({
  distance,
  bubbles,
  username,
  rankResult,
  challenge,
  challengeBeaten = false,
  baseShareUrl = SURF_SHARE_URL,
}: BuildSurfShareInput): SurfShareIntent {
  const runDistance = normalizedDistance(distance);
  const bubbleCount = normalizedBubbles(bubbles);
  const by = normalizedUsername(username);

  let cardDistance = runDistance;
  let rankForCard: number | undefined;
  let opener: string;

  if (challengeBeaten && challenge) {
    opener = `I smashed ${
      challenge.by ? `@${challenge.by}'s` : "the"
    } ${challenge.distance}m challenge — rode ${runDistance}m in Streme Surf 🏄🌊`;

    if (rankAppliesToDistance(rankResult, runDistance)) {
      rankForCard = rankResult.rank;
      opener += `\n\nNow #${rankResult.rank} on the leaderboard 🏆`;
    }
  } else if (rankResult) {
    cardDistance = normalizedDistance(rankResult.best);
    rankForCard = rankResult.rank;
    opener = `I'm #${rankResult.rank} of ${rankResult.total} on the Streme Surf leaderboard with a ${cardDistance}m ride 🏄🌊`;
  } else {
    opener = `I rode the stream ${runDistance}m and popped ${bubbleCount} bubbles in Streme Surf 🏄🌊`;
  }

  const params = new URLSearchParams({ d: String(cardDistance) });
  if (by) params.set("by", by);
  if (rankForCard) params.set("r", String(rankForCard));

  const shareUrl = `${baseShareUrl}?${params.toString()}`;
  return {
    shareUrl,
    castText: `${opener}\n\nThink you can beat my ride?\n\n${shareUrl}`,
  };
}
