import { publicClient } from "./viemClient";

// The Warplets (Farcaster) — opensea.io/collection/the-warplets-farcaster
export const WARPLET_NFT = "0x699727f9e01a822efdcf7333073f0461e5914b4e" as const;
const STREME = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as const;
// stToken contract — balanceOf returns the wallet-held staked STREME (18 decimals),
// exactly what the token page reads as "My Staked Balance". NOTE: the GDA staking
// *pool* (0xa040…aa1c) is NOT this — its balanceOf returns unscaled reward units
// (~staked-tokens with no 18 decimals), so reading it here under-reported stakers
// by ~1e18× and made heavy stakers look like they held nothing.
const STAKED_STREME = "0x93419f1c0f73b278c73085c17407794a6580deff" as const;
// Crowdfund deposits: staked STREME parked in the rewards funder (also 18 decimals)
const STAKE_FUNDER = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b" as const;
const MIN_HOLD = 10_000_000n * 10n ** 18n; // 10,000,000 STREME (18 decimals)
const MAX_WARPLETS = 24;

const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const enumerableAbi = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface WarpletItem {
  tokenId: string;
  name: string;
  image: string; // same-origin proxy URL, canvas-safe
}

export interface WarpletEligibility {
  eligible: boolean;
  streme: number; // formatted (whole STREME)
  staked: number;
  ownsWarplet: boolean;
  warplets: WarpletItem[];
}

// Public IPFS gateways, RACED in parallel (first OK wins) so a slow or dead host
// never blocks a Warplet's image. (cloudflare-ipfs.com is intentionally gone —
// it was shut down; ipfs.io is kept but often slow, hence the race.)
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://w3s.link/ipfs/",
  "https://4everland.io/ipfs/",
];

/** Pull the CID(+path) out of an ipfs://… or …/ipfs/… URL, else null. */
function ipfsPath(uri: string): string | null {
  if (uri.startsWith("ipfs://")) return uri.slice(7).replace(/^ipfs\//, "");
  const m = uri.match(/\/ipfs\/(.+)$/);
  return m ? m[1] : null;
}

/** ipfs://CID (and /ipfs/CID) → a public gateway URL (first gateway). */
export function resolveIpfs(uri: string): string {
  const path = ipfsPath(uri);
  return path ? `${IPFS_GATEWAYS[0]}${path}` : uri;
}

/**
 * Fetch an asset that may live on IPFS, trying each gateway in turn; `data:` and
 * plain http(s) URLs are fetched directly. Returns the first OK response, or null.
 */
export async function fetchAsset(
  uri: string,
  accept: string
): Promise<Response | null> {
  const path = ipfsPath(uri);
  const urls = path ? IPFS_GATEWAYS.map((g) => g + path) : [uri];
  const attempts = urls.map((url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    return fetch(url, { headers: { Accept: accept }, signal: ctrl.signal })
      .then((res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error(`${res.status}`);
        return res;
      })
      .catch((e) => {
        clearTimeout(timer);
        throw e;
      });
  });
  try {
    // first gateway to return OK wins; the slow/dead ones are abandoned
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

/** Best-effort SYNC decode of an inline JSON tokenURI (base64 or plain). */
function decodeDataUri(uri: string): { name?: string; image?: string } | null {
  const b64 = uri.match(/^data:application\/json;base64,(.*)$/);
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64[1], "base64").toString("utf-8"));
    } catch {
      return null;
    }
  }
  const plain = uri.match(/^data:application\/json(?:;[^,]*)?,([\s\S]*)$/);
  if (plain) {
    try {
      return JSON.parse(decodeURIComponent(plain[1]));
    } catch {
      try {
        return JSON.parse(plain[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Load a Warplet's metadata from ANY tokenURI shape: on-chain base64 JSON,
 * on-chain plain/url-encoded JSON, or an off-chain ipfs://… / https://… URL.
 */
async function loadMetadata(
  uri: string
): Promise<{ name?: string; image?: string } | null> {
  if (!uri) return null;
  const inline = decodeDataUri(uri);
  if (inline) return inline;
  if (uri.startsWith("ipfs://") || uri.startsWith("http")) {
    const res = await fetchAsset(uri, "application/json");
    if (res) {
      try {
        return (await res.json()) as { name?: string; image?: string };
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Read & decode a single Warplet's image URI (used by the image proxy). */
export async function getWarpletImageUri(tokenId: bigint): Promise<string | null> {
  try {
    const uri = (await publicClient.readContract({
      address: WARPLET_NFT,
      abi: enumerableAbi,
      functionName: "tokenURI",
      args: [tokenId],
    })) as string;
    const meta = await loadMetadata(uri);
    // raw image — may be ipfs://, https://, or a data: URI; the proxy resolves it
    return meta?.image || null;
  } catch {
    return null;
  }
}

export async function getWarpletEligibility(
  address: string
): Promise<WarpletEligibility> {
  const addr = address as `0x${string}`;
  const empty: WarpletEligibility = {
    eligible: false,
    streme: 0,
    staked: 0,
    ownsWarplet: false,
    warplets: [],
  };

  let stremeBal = 0n;
  let stakedBal = 0n;
  let nftBal = 0n;
  try {
    const [streme, staked, funder, nft] = await publicClient.multicall({
      contracts: [
        { address: STREME, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
        { address: STAKED_STREME, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
        { address: STAKE_FUNDER, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
        { address: WARPLET_NFT, abi: enumerableAbi, functionName: "balanceOf", args: [addr] },
      ],
    });
    stremeBal = streme.status === "success" ? (streme.result as bigint) : 0n;
    const directStake = staked.status === "success" ? (staked.result as bigint) : 0n;
    const funderStake = funder.status === "success" ? (funder.result as bigint) : 0n;
    // wallet-held stToken + crowdfund-deposited stToken (both 18 decimals)
    stakedBal = directStake + funderStake;
    nftBal = nft.status === "success" ? (nft.result as bigint) : 0n;
  } catch (e) {
    console.error("warplet eligibility multicall failed:", e);
    return empty;
  }

  const hasHold = stremeBal >= MIN_HOLD || stakedBal >= MIN_HOLD;
  const ownsWarplet = nftBal > 0n;
  const result: WarpletEligibility = {
    eligible: hasHold && ownsWarplet,
    streme: Number(stremeBal / 10n ** 18n),
    staked: Number(stakedBal / 10n ** 18n),
    ownsWarplet,
    warplets: [],
  };

  // Only enumerate the warplets if they actually qualify
  if (!result.eligible) return result;

  try {
    const count = Math.min(Number(nftBal), MAX_WARPLETS);
    const idCalls = Array.from({ length: count }, (_, i) => ({
      address: WARPLET_NFT,
      abi: enumerableAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [addr, BigInt(i)] as const,
    }));
    const ids = await publicClient.multicall({ contracts: idCalls });
    const tokenIds = ids
      .filter((r) => r.status === "success")
      .map((r) => r.result as bigint);

    const uriCalls = tokenIds.map((id) => ({
      address: WARPLET_NFT,
      abi: enumerableAbi,
      functionName: "tokenURI" as const,
      args: [id] as const,
    }));
    const uris = await publicClient.multicall({ contracts: uriCalls });
    result.warplets = tokenIds.map((id, i) => {
      const uriRes = uris[i];
      const meta =
        uriRes && uriRes.status === "success"
          ? decodeDataUri(uriRes.result as string)
          : null;
      return {
        tokenId: id.toString(),
        name: meta?.name || `Warplet #${id.toString()}`,
        image: `/api/skate/warplet-image?token=${id.toString()}`,
      };
    });
  } catch (e) {
    console.error("warplet enumeration failed:", e);
  }

  return result;
}
