// Streme Pulse — shared types for the automated growth engine.
// The engine ranks tokens with a legible streaming-native score, detects
// milestones, and drives the @streme bot's automated casts.

export interface PulseTokenMetrics {
  /** Lowercase contract address */
  address: string;
  name: string;
  symbol: string;
  img_url: string | null;
  username?: string;
  /** Unix seconds the token launched */
  createdAt: number;
  /** Unix seconds of the last recorded trade (0 if unknown) */
  lastTradedAt: number;
  marketCap: number;
  price: number;
  volume24h: number;
  change1h: number;
  change24h: number;
  /** GDA staking pool address, when known */
  stakingPool?: string;
  /** Number of GDA pool members (stakers), from the Superfluid subgraph */
  totalStakers?: number;
  /** Reward stream to stakers in tokens/day, from the pool flow rate */
  rewardFlowPerDay?: number;
}

export interface PulseToken extends PulseTokenMetrics {
  rank: number;
  /** 0-100, see score.ts for the formula */
  score: number;
  /** Human-readable reasons this token ranks where it does */
  reasons: string[];
}

export interface PulseTotals {
  trackedTokens: number;
  /** Tokens with a trade in the last 24h */
  activeTokens24h: number;
  volume24h: number;
  marketCap: number;
  launches7d: number;
}

export interface PulseSnapshot {
  /** Unix seconds */
  generatedAt: number;
  tokens: PulseToken[];
  totals: PulseTotals;
}

export type MilestoneType = "market_cap";

export interface Milestone {
  /** `${type}:${address}:${threshold}` — stable id used for dedup */
  id: string;
  type: MilestoneType;
  tokenAddress: string;
  symbol: string;
  name: string;
  /** Farcaster username of the token creator, when known */
  creatorUsername?: string;
  threshold: number;
  /** Metric value when the milestone was detected */
  value: number;
  /** Unix seconds */
  detectedAt: number;
}

export type CastKind = "daily_pulse" | "milestone";

export interface CastDraft {
  kind: CastKind;
  /** Neynar idempotency key (also our dedup key) */
  idem: string;
  text: string;
  embedUrl: string;
}

export type CastStatus = "dry_run" | "published" | "failed" | "skipped";

export interface CastRecord extends CastDraft {
  status: CastStatus;
  castHash?: string;
  error?: string;
  /** Unix seconds */
  createdAt: number;
}

export interface PulseRunReport {
  /** Unix seconds */
  ranAt: number;
  durationMs: number;
  tokensTracked: number;
  newMilestones: number;
  casts: CastRecord[];
  /** Holder notifications attempted for new milestones (see notifications.ts) */
  notifications: import("./notifications").NotificationRecord[];
  /** Whether live casting was enabled for this run */
  liveCasting: boolean;
  errors: string[];
}
