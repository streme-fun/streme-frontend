// Agent gateway actions — the shared layer behind both the REST API
// (/api/agent/*) and the MCP server (/api/mcp). Everything here returns
// plain JSON designed to be read by language models: compact, labeled,
// self-explanatory.

import { SPAMMER_BLACKLIST, BLACKLISTED_TOKENS } from "@/src/lib/blacklist";
import { recordBuild, recordToolInvocation } from "@/src/lib/floor/telemetry";
import { getAccountYield } from "@/src/lib/yield";
import { computeSnapshot } from "@/src/lib/pulse/engine";
import { getLatestSnapshot, setLatestSnapshot } from "@/src/lib/pulse/store";
import {
  AgentInputError,
  assertAddress,
  buildBuyTx,
  buildConnectPoolTx,
  buildStakeTx,
  buildStreamTx,
  buildUnstakeTx,
  type WatermarkOptions,
} from "./txBuilders";

export { AgentInputError };

const TOKEN_URL = "https://api.streme.fun/token";
const TRENDING_URL = "https://api.streme.fun/api/tokens/trending?type=all";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://streme.fun"
  );
}

interface UpstreamToken {
  contract_address?: string;
  name?: string;
  symbol?: string;
  img_url?: string | null;
  username?: string;
  type?: string;
  staking_address?: string;
  staking_pool?: string;
  timestamp?: { _seconds?: number };
  lastTraded?: { _seconds?: number };
  marketData?: {
    marketCap?: number;
    price?: number;
    volume24h?: number;
    priceChange24h?: number;
  };
}

export interface AgentToken {
  address: string;
  name: string;
  symbol: string;
  creatorFarcasterUsername?: string;
  createdAt: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  priceChange24hPct: number;
  lastTradedAt: number;
  staking: {
    stakingAddress?: string;
    rewardPoolAddress?: string;
    lpType: "uniswap" | "aero";
    howToStake: string;
  };
  pageUrl: string;
}

function toAgentToken(t: UpstreamToken): AgentToken | null {
  const address = t.contract_address?.toLowerCase();
  if (!address || !t.name || !t.symbol) return null;
  return {
    address,
    name: t.name,
    symbol: t.symbol.replace(/^\$/, ""),
    creatorFarcasterUsername: t.username,
    createdAt: t.timestamp?._seconds ?? 0,
    priceUsd: t.marketData?.price ?? 0,
    marketCapUsd: t.marketData?.marketCap ?? 0,
    volume24hUsd: t.marketData?.volume24h ?? 0,
    priceChange24hPct: t.marketData?.priceChange24h ?? 0,
    lastTradedAt: t.lastTraded?._seconds ?? 0,
    staking: {
      stakingAddress: t.staking_address?.toLowerCase(),
      rewardPoolAddress: t.staking_pool?.toLowerCase(),
      lpType:
        t.type === "v2aero" || t.type === "v2aeronew" ? "aero" : "uniswap",
      howToStake:
        "Use build_stake_transaction (a single ERC777 send to the StakingHelper — no approval), then build_connect_pool_transaction once so rewards show in the balance.",
    },
    pageUrl: `${appUrl()}/token/${address}`,
  };
}

function blacklisted(t: UpstreamToken): boolean {
  if (t.username && SPAMMER_BLACKLIST.includes(t.username.toLowerCase()))
    return true;
  if (
    t.contract_address &&
    BLACKLISTED_TOKENS.includes(t.contract_address.toLowerCase())
  )
    return true;
  return false;
}

export async function listTokens(params: {
  query?: string;
  limit?: number;
}): Promise<AgentToken[]> {
  // Telemetry is fire-and-forget by contract (never rejects) — don't await.
  void recordToolInvocation({ tool: "list_streme_tokens", params });
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
  const response = await fetch(TRENDING_URL, {
    headers: { Accept: "application/json", "User-Agent": "Streme-Agent/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Trending API error: ${response.status}`);

  const tokens: UpstreamToken[] = await response.json();
  const q = params.query?.trim().toLowerCase();

  return tokens
    .filter((t) => !blacklisted(t))
    .filter((t) => {
      if (!q) return true;
      return (
        t.name?.toLowerCase().includes(q) ||
        t.symbol?.toLowerCase().replace(/^\$/, "").includes(q) ||
        t.contract_address?.toLowerCase() === q
      );
    })
    .map(toAgentToken)
    .filter((t): t is AgentToken => t !== null)
    .slice(0, limit);
}

export async function getToken(address: string): Promise<AgentToken> {
  void recordToolInvocation({ tool: "get_streme_token", params: { address } });
  return resolveToken(address);
}

/**
 * Internal single-token resolution shared by getToken and every builder —
 * uninstrumented so builder calls don't inflate the get_streme_token counter.
 */
async function resolveToken(address: string): Promise<AgentToken> {
  const normalized = assertAddress(address, "address");
  // Blacklist enforcement: every single-token lookup and build path funnels
  // through here, so blacklisted tokens never resolve (R18).
  if (BLACKLISTED_TOKENS.includes(normalized)) {
    throw new AgentInputError(`No Streme token found at ${normalized}`);
  }
  const response = await fetch(`${TOKEN_URL}/${normalized}`, {
    headers: { Accept: "application/json", "User-Agent": "Streme-Agent/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) {
    throw new AgentInputError(`No Streme token found at ${normalized}`);
  }
  if (!response.ok) throw new Error(`Token API error: ${response.status}`);

  const payload = await response.json();
  const upstream: UpstreamToken = payload?.data ?? payload;
  if (blacklisted(upstream)) {
    throw new AgentInputError(`No Streme token found at ${normalized}`);
  }
  const token = toAgentToken(upstream);
  if (!token) throw new AgentInputError(`No Streme token found at ${normalized}`);
  return token;
}

export async function getPulse() {
  void recordToolInvocation({ tool: "get_streme_pulse", params: {} });
  const now = Math.floor(Date.now() / 1000);
  let snapshot = await getLatestSnapshot();
  if (!snapshot || now - snapshot.generatedAt > 30 * 60) {
    snapshot = await computeSnapshot(now);
    await setLatestSnapshot(snapshot);
  }
  return {
    generatedAt: snapshot.generatedAt,
    totals: snapshot.totals,
    topTokens: snapshot.tokens.slice(0, 10).map((t) => ({
      rank: t.rank,
      address: t.address,
      symbol: t.symbol,
      score: t.score,
      reasons: t.reasons,
      priceUsd: t.price,
      marketCapUsd: t.marketCap,
      volume24hUsd: t.volume24h,
      stakers: t.totalStakers,
      pageUrl: `${appUrl()}/token/${t.address}`,
    })),
  };
}

export async function getYield(address: string) {
  void recordToolInvocation({ tool: "get_wallet_yield", params: { address } });
  const normalized = assertAddress(address, "address");
  const accountYield = await getAccountYield(normalized);
  return {
    ...accountYield,
    flexCardUrl: `${appUrl()}/yield/${normalized}`,
    note: "Share flexCardUrl to show this wallet's live streams (renders a dynamic image).",
  };
}

/**
 * Buy helper that resolves the token's staking address + LP type when the
 * caller wants auto-stake but only knows the token address.
 */
export async function buildBuyTxForToken(
  params: {
    tokenAddress: string;
    ethAmount: string;
    stake?: boolean;
    slippageBps?: number;
  } & WatermarkOptions
) {
  void recordToolInvocation({
    tool: "build_buy_transaction",
    params,
    agentId: params.agentId,
  });
  const token = await resolveToken(params.tokenAddress);
  const built = await buildBuyTx({
    tokenAddress: token.address,
    ethAmount: params.ethAmount,
    stake: params.stake,
    stakingAddress: token.staking.stakingAddress,
    lpType: token.staking.lpType,
    slippageBps: params.slippageBps,
    agentId: params.agentId,
    source: params.source,
    internalAgentId: params.internalAgentId,
  });
  void recordBuild({
    tool: "build_buy_transaction",
    agentId: params.agentId,
    to: built.tx.to,
    data: built.tx.data,
  });
  return built;
}

export async function buildStakeTxForToken(
  params: { tokenAddress: string; amount: string } & WatermarkOptions
) {
  void recordToolInvocation({
    tool: "build_stake_transaction",
    params,
    agentId: params.agentId,
  });
  // Validate it's a real Streme token before handing out calldata.
  const token = await resolveToken(params.tokenAddress);
  const built = buildStakeTx({
    tokenAddress: token.address,
    amount: params.amount,
    agentId: params.agentId,
    source: params.source,
    internalAgentId: params.internalAgentId,
  });
  void recordBuild({
    tool: "build_stake_transaction",
    agentId: params.agentId,
    to: built.tx.to,
    data: built.tx.data,
  });
  return built;
}

export async function buildUnstakeTxForToken(
  params: { tokenAddress: string; to: string; amount: string } & WatermarkOptions
) {
  void recordToolInvocation({
    tool: "build_unstake_transaction",
    params,
    agentId: params.agentId,
  });
  const token = await resolveToken(params.tokenAddress);
  if (!token.staking.stakingAddress) {
    throw new AgentInputError(
      `Token ${token.symbol} has no staking contract on record`
    );
  }
  const built = buildUnstakeTx({
    stakingAddress: token.staking.stakingAddress,
    to: params.to,
    amount: params.amount,
    agentId: params.agentId,
    source: params.source,
    internalAgentId: params.internalAgentId,
  });
  void recordBuild({
    tool: "build_unstake_transaction",
    agentId: params.agentId,
    to: built.tx.to,
    data: built.tx.data,
  });
  return built;
}

export async function buildConnectPoolTxForToken(
  params: { tokenAddress: string } & WatermarkOptions
) {
  void recordToolInvocation({
    tool: "build_connect_pool_transaction",
    params,
    agentId: params.agentId,
  });
  const token = await resolveToken(params.tokenAddress);
  if (!token.staking.rewardPoolAddress) {
    throw new AgentInputError(
      `Token ${token.symbol} has no reward pool on record`
    );
  }
  const built = buildConnectPoolTx({
    poolAddress: token.staking.rewardPoolAddress,
    agentId: params.agentId,
    source: params.source,
    internalAgentId: params.internalAgentId,
  });
  void recordBuild({
    tool: "build_connect_pool_transaction",
    agentId: params.agentId,
    to: built.tx.to,
    data: built.tx.data,
  });
  return built;
}

export async function buildStreamTxForToken(
  params: {
    tokenAddress: string;
    receiver: string;
    tokensPerDay: string;
  } & WatermarkOptions
) {
  void recordToolInvocation({
    tool: "build_stream_transaction",
    params,
    agentId: params.agentId,
  });
  // Validate it's a real (non-blacklisted) Streme token before streaming it.
  const token = await resolveToken(params.tokenAddress);
  const built = buildStreamTx({
    tokenAddress: token.address,
    receiver: params.receiver,
    tokensPerDay: params.tokensPerDay,
    agentId: params.agentId,
    source: params.source,
    internalAgentId: params.internalAgentId,
  });
  void recordBuild({
    tool: "build_stream_transaction",
    agentId: params.agentId,
    to: built.tx.to,
    data: built.tx.data,
  });
  return built;
}

/** Self-describing capabilities document (GET /api/agent). */
export function capabilities() {
  void recordToolInvocation({ tool: "get_streme_capabilities", params: {} });
  const base = appUrl();
  return {
    name: "Streme Agent Gateway",
    description:
      "Programmatic access to Streme — a token launchpad on Base where every token streams staking rewards by the second (Superfluid). Agents read market data and receive unsigned transactions to sign with their own wallets. Streme never holds keys.",
    chain: { name: "Base", chainId: 8453 },
    mcp: {
      url: `${base}/api/mcp`,
      transport: "streamable-http",
      note: "Add this URL to any MCP-capable agent (Claude, Cursor, etc.) to use Streme as a tool server.",
    },
    docs: `${base}/llms.txt`,
    rest: {
      "GET /api/agent": "this document",
      "GET /api/agent/tokens?q=&limit=": "search/list trending Streme tokens",
      "GET /api/agent/token/{address}": "one token with staking info",
      "GET /api/agent/yield/{address}": "a wallet's live reward streams",
      "GET /api/pulse": "trending snapshot, milestones, bot activity",
      "GET /api/agents/floor":
        "chain-verified agent activity: recent events with verification tiers, daily counters, the Resident's journal",
      "POST /api/agent/tx/buy":
        "{tokenAddress, ethAmount, stake?, slippageBps?, agentId?} → unsigned zap tx (ETH→token, optional auto-stake)",
      "POST /api/agent/tx/stake":
        "{tokenAddress, amount, agentId?} → unsigned ERC777 send to StakingHelper (no approval needed)",
      "POST /api/agent/tx/unstake":
        "{tokenAddress, to, amount, agentId?} → unsigned unstake tx",
      "POST /api/agent/tx/connect-pool":
        "{tokenAddress, agentId?} → unsigned GDA connectPool tx (one-time per token; makes rewards visible)",
      "POST /api/agent/tx/stream":
        "{tokenAddress, receiver, tokensPerDay, agentId?} → unsigned Superfluid stream tx (0 stops the stream)",
    },
    txContract: {
      shape: "{ description, tx: { to, data, value?, chainId }, notes[] }",
      signing:
        "Sign and broadcast tx with the agent's own wallet on Base (chainId 8453). Always include chainId.",
      agentId:
        "Optional self-declared identifier (lowercase [a-z0-9-_.], max 32 chars) embedded in the transaction's watermark for attribution on the Agent Floor.",
    },
  };
}
