import { Redis } from "@upstash/redis";
import { publicClient } from "./viemClient";
import { getNeynarUser } from "./neynar";
import { FlairTier, isFlairTier } from "./skateFlair";

// Crew flair resolution — server-only. A player's tier is computed from THEIR
// OWN wallets (the FID's Neynar-verified eth addresses + custody address), so
// a client can never claim someone else's whale wallet for a badge.
//
// Token addresses match src/lib/warplets.ts — see the note there about reading
// staked balance from the stToken contract, NOT the GDA pool.
const STREME = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as const;
const STAKED_STREME = "0x93419f1c0f73b278c73085c17407794a6580deff" as const;
const STAKE_FUNDER = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b" as const;

const MILLION = 1_000_000n * 10n ** 18n;
const DECK_MIN = 1n * MILLION; // held or staked
const SPONSORED_MIN = 10n * MILLION; // staked only
const PRO_MIN = 100n * MILLION; // staked only

// bound the multicall — power users can verify many addresses
const MAX_ADDRESSES = 8;

const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

const ENV_SUFFIX = process.env.NODE_ENV === "production" ? "" : ":dev";
const flairKey = (fid: number) => `streme-skate:flair:${fid}${ENV_SUFFIX}`;
// balances are rechecked at most this often per player (refreshed on submit);
// a sold/staked wallet updates the badge within hours, not instantly
const FLAIR_TTL = 6 * 3600;

const localFlair = new Map<number, { value: FlairTier | null; expires: number }>();

async function computeFlair(
  addresses: `0x${string}`[]
): Promise<FlairTier | null> {
  if (addresses.length === 0) return null;
  const contracts = addresses.flatMap((addr) => [
    { address: STREME, abi: erc20Abi, functionName: "balanceOf" as const, args: [addr] as const },
    { address: STAKED_STREME, abi: erc20Abi, functionName: "balanceOf" as const, args: [addr] as const },
    { address: STAKE_FUNDER, abi: erc20Abi, functionName: "balanceOf" as const, args: [addr] as const },
  ]);
  const results = await publicClient.multicall({ contracts });
  let held = 0n;
  let staked = 0n;
  for (let i = 0; i < results.length; i += 3) {
    const at = (j: number) =>
      results[j]?.status === "success" ? (results[j].result as bigint) : 0n;
    held += at(i);
    staked += at(i + 1) + at(i + 2); // wallet stToken + crowdfund-deposited stToken
  }
  if (staked >= PRO_MIN) return "pro";
  if (staked >= SPONSORED_MIN) return "sponsored";
  if (held >= DECK_MIN || staked >= DECK_MIN) return "deck";
  return null;
}

/**
 * Resolve a player's crew flair, cached per fid. Never throws — any failure
 * (Neynar down, RPC hiccup, no API key in dev) just means "no flair this
 * submit", and the next submit retries after the cache expires.
 */
export async function getFlairForFid(fid: number): Promise<FlairTier | null> {
  try {
    if (redis) {
      const cached = await redis.get<string>(flairKey(fid));
      if (cached !== null) return isFlairTier(cached) ? cached : null;
    } else {
      const cached = localFlair.get(fid);
      if (cached && cached.expires > Date.now()) return cached.value;
    }

    const user = await getNeynarUser(fid);
    const addrs = new Set<string>();
    for (const a of user?.verified_addresses?.eth_addresses ?? []) {
      addrs.add(a.toLowerCase());
    }
    if (user?.custody_address) addrs.add(user.custody_address.toLowerCase());
    const addresses = [...addrs]
      .filter((a): a is `0x${string}` => /^0x[0-9a-f]{40}$/.test(a))
      .slice(0, MAX_ADDRESSES);

    const tier = await computeFlair(addresses);

    if (redis) {
      await redis.set(flairKey(fid), tier ?? "none", { ex: FLAIR_TTL });
    } else {
      localFlair.set(fid, {
        value: tier,
        expires: Date.now() + FLAIR_TTL * 1000,
      });
    }
    return tier;
  } catch (e) {
    console.error("skate flair lookup failed:", e);
    return null;
  }
}
