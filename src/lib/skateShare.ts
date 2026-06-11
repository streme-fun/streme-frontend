export interface SkateChallenge {
  score: number;
  by?: string;
  rank?: number;
}

export interface SkateRankResult {
  best: number;
  rank: number;
  total: number;
  improved: boolean;
}

export const SKATE_SHARE_URL = "https://streme.fun/skate";
export const SKATE_DISPLAY_URL = "streme.fun/skate";

interface BuildSkateShareInput {
  score: number;
  combo: number;
  username?: string;
  rankResult?: SkateRankResult | null;
  challenge?: SkateChallenge | null;
  challengeBeaten?: boolean;
  baseShareUrl?: string;
}

interface SkateShareIntent {
  shareUrl: string;
  castText: string;
}

const USERNAME_RE = /^[a-z0-9_.-]{1,32}$/i;
const MAX_SHARE_SCORE = 100_000_000;

function normalizedScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(Math.max(Math.floor(score), 0), MAX_SHARE_SCORE);
}

function normalizedCombo(combo: number): number {
  if (!Number.isFinite(combo)) return 0;
  return Math.max(Math.floor(combo), 0);
}

function normalizedUsername(username?: string): string | undefined {
  return username && USERNAME_RE.test(username) ? username : undefined;
}

function rankAppliesToScore(
  rankResult: SkateRankResult | null | undefined,
  score: number
): rankResult is SkateRankResult {
  return Boolean(rankResult && normalizedScore(rankResult.best) === score);
}

export function buildSkateShareIntent({
  score,
  combo,
  username,
  rankResult,
  challenge,
  challengeBeaten = false,
  baseShareUrl = SKATE_SHARE_URL,
}: BuildSkateShareInput): SkateShareIntent {
  const runScore = normalizedScore(score);
  const comboCount = normalizedCombo(combo);
  const by = normalizedUsername(username);

  let cardScore = runScore;
  let rankForCard: number | undefined;
  let opener: string;

  if (challengeBeaten && challenge) {
    opener = `I smashed ${
      challenge.by ? `@${challenge.by}'s` : "the"
    } ${challenge.score.toLocaleString()} challenge — scored ${runScore.toLocaleString()} in Streme Skate 🛹⚡`;

    if (rankAppliesToScore(rankResult, runScore)) {
      rankForCard = rankResult.rank;
      opener += `\n\nNow #${rankResult.rank} on the leaderboard 🏆`;
    }
  } else if (rankResult) {
    cardScore = normalizedScore(rankResult.best);
    rankForCard = rankResult.rank;
    opener = `I'm #${rankResult.rank} of ${rankResult.total} on the Streme Skate leaderboard with ${cardScore.toLocaleString()} points 🛹⚡`;
  } else {
    opener = `I scored ${runScore.toLocaleString()} on a ${comboCount.toLocaleString()}-point combo in Streme Skate 🛹⚡`;
  }

  const params = new URLSearchParams({ s: String(cardScore) });
  if (by) params.set("by", by);
  if (rankForCard) params.set("r", String(rankForCard));

  const shareUrl = `${baseShareUrl}?${params.toString()}`;
  return {
    shareUrl,
    castText: `${opener}\n\nThink you can beat my line?\n\n${shareUrl}`,
  };
}
