// Account yield aggregation — the data behind the "flex my stream" cards.
//
// For a wallet, reads every Streme GDA pool membership from the Superfluid
// subgraph, computes the member's share of each reward stream, and decorates
// the top flows with token metadata + USD rates from the Streme API.

import { BLACKLISTED_TOKENS } from "@/src/lib/blacklist";

const SUBGRAPH_URL =
  "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1";
const TOKENS_MULTIPLE_URL = "https://api.streme.fun/api/tokens/multiple";
const MAX_FLOWS = 12;
const SECONDS_PER_DAY = 86400n;
const WAD = 10n ** 18n;

export interface YieldFlow {
  tokenAddress: string;
  symbol: string;
  name: string;
  img_url: string | null;
  /** Reward stream to this wallet, in tokens/day */
  tokensPerDay: number;
  /** Same stream valued in USD/day, when a price is known */
  usdPerDay: number | null;
  poolId: string;
  isConnected: boolean;
}

export interface AccountYield {
  address: string;
  /** Total over flows with a known price */
  totalUsdPerDay: number;
  /** Number of active reward streams (units > 0) */
  activeStreams: number;
  flows: YieldFlow[];
  /** Unix seconds */
  generatedAt: number;
}

interface MembershipNode {
  units: string;
  isConnected: boolean;
  pool: {
    id: string;
    flowRate: string;
    totalUnits: string;
    token: {
      id: string;
      symbol: string;
      isNativeAssetSuperToken: boolean;
    };
  };
}

interface UpstreamTokenMeta {
  contract_address?: string;
  name?: string;
  symbol?: string;
  img_url?: string | null;
  marketData?: { price?: number };
}

/** flowRate (wei/s) * units / totalUnits → tokens/day, via BigInt. */
function memberTokensPerDay(
  flowRate: string,
  units: string,
  totalUnits: string
): number {
  try {
    const flow = BigInt(flowRate);
    const memberUnits = BigInt(units);
    const total = BigInt(totalUnits);
    if (flow <= 0n || memberUnits <= 0n || total <= 0n) return 0;

    // Scale by 1e6 before the division so small shares keep precision.
    const scaled = (flow * SECONDS_PER_DAY * memberUnits * 1_000_000n) / total;
    return Number(scaled / WAD) / 1_000_000;
  } catch {
    return 0;
  }
}

async function fetchMemberships(address: string): Promise<MembershipNode[]> {
  const query = `
    query AccountYield($accountId: ID!) {
      account(id: $accountId) {
        poolMemberships(first: 200) {
          units
          isConnected
          pool {
            id
            flowRate
            totalUnits
            token {
              id
              symbol
              isNativeAssetSuperToken
            }
          }
        }
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { accountId: address.toLowerCase() },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Subgraph error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0]?.message || "Subgraph query failed");
  }
  return data.data?.account?.poolMemberships ?? [];
}

async function fetchTokenMeta(
  addresses: string[]
): Promise<Record<string, UpstreamTokenMeta>> {
  if (addresses.length === 0) return {};
  try {
    const response = await fetch(TOKENS_MULTIPLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenAddresses: addresses.slice(0, 30) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return {};
    const payload = await response.json();
    const tokens: UpstreamTokenMeta[] = Array.isArray(payload)
      ? payload
      : payload?.data ?? [];
    const byAddress: Record<string, UpstreamTokenMeta> = {};
    for (const token of tokens) {
      if (token?.contract_address) {
        byAddress[token.contract_address.toLowerCase()] = token;
      }
    }
    return byAddress;
  } catch {
    return {};
  }
}

export async function getAccountYield(address: string): Promise<AccountYield> {
  const normalized = address.toLowerCase();
  const memberships = await fetchMemberships(normalized);

  const active = memberships.filter((m) => {
    if (!m.units || parseFloat(m.units) <= 0) return false;
    if (m.pool.token.isNativeAssetSuperToken) return false;
    if (BLACKLISTED_TOKENS.includes(m.pool.token.id.toLowerCase()))
      return false;
    return true;
  });

  // A wallet can be in several reward pools for the same token (e.g. v1 +
  // migrated staking pools) — aggregate per token so it appears once.
  const byToken = new Map<
    string,
    {
      tokenAddress: string;
      symbol: string;
      poolId: string;
      isConnected: boolean;
      tokensPerDay: number;
    }
  >();
  for (const m of active) {
    const tokensPerDay = memberTokensPerDay(
      m.pool.flowRate,
      m.units,
      m.pool.totalUnits
    );
    if (tokensPerDay <= 0) continue;

    const tokenAddress = m.pool.token.id.toLowerCase();
    const existing = byToken.get(tokenAddress);
    if (existing) {
      existing.tokensPerDay += tokensPerDay;
      existing.isConnected = existing.isConnected || m.isConnected;
    } else {
      byToken.set(tokenAddress, {
        tokenAddress,
        symbol: m.pool.token.symbol.replace(/^\$/, ""),
        poolId: m.pool.id.toLowerCase(),
        isConnected: m.isConnected,
        tokensPerDay,
      });
    }
  }

  const flowsRaw = [...byToken.values()]
    .sort((a, b) => b.tokensPerDay - a.tokensPerDay)
    .slice(0, MAX_FLOWS);

  const meta = await fetchTokenMeta(flowsRaw.map((f) => f.tokenAddress));

  const flows: YieldFlow[] = flowsRaw
    .map((f) => {
      const m = meta[f.tokenAddress];
      const price = m?.marketData?.price;
      return {
        ...f,
        name: m?.name ?? f.symbol,
        img_url: m?.img_url ?? null,
        usdPerDay:
          typeof price === "number" && price > 0
            ? f.tokensPerDay * price
            : null,
      };
    })
    .sort(
      (a, b) =>
        (b.usdPerDay ?? 0) - (a.usdPerDay ?? 0) ||
        b.tokensPerDay - a.tokensPerDay
    );

  return {
    address: normalized,
    totalUsdPerDay: flows.reduce((sum, f) => sum + (f.usdPerDay ?? 0), 0),
    activeStreams: flows.length,
    flows,
    generatedAt: Math.floor(Date.now() / 1000),
  };
}
