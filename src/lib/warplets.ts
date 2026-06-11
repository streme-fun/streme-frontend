import { publicClient } from "./viemClient";

// The Warplets (Farcaster) — opensea.io/collection/the-warplets-farcaster
export const WARPLET_NFT = "0x699727f9e01a822efdcf7333073f0461e5914b4e" as const;
const STREME = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as const;
const STAKE_POOL = "0xa040a8564c433970d7919c441104b1d25b9eaa1c" as const;
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

/** ipfs://CID (and /ipfs/CID) → a public gateway URL. */
export function resolveIpfs(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7).replace(/^ipfs\//, "")}`;
  }
  return uri;
}

/** Decode an on-chain `data:application/json;base64,...` tokenURI. */
function decodeDataUri(uri: string): { name?: string; image?: string } | null {
  const m = uri.match(/^data:application\/json;base64,(.*)$/);
  if (!m) return null;
  try {
    const json = Buffer.from(m[1], "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Read & decode a single Warplet's metadata (used by the image proxy). */
export async function getWarpletImageUri(tokenId: bigint): Promise<string | null> {
  try {
    const uri = (await publicClient.readContract({
      address: WARPLET_NFT,
      abi: enumerableAbi,
      functionName: "tokenURI",
      args: [tokenId],
    })) as string;
    const meta = decodeDataUri(uri);
    return meta?.image ? resolveIpfs(meta.image) : null;
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
    const [streme, pool, funder, nft] = await publicClient.multicall({
      contracts: [
        { address: STREME, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
        { address: STAKE_POOL, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
        { address: STAKE_FUNDER, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
        { address: WARPLET_NFT, abi: enumerableAbi, functionName: "balanceOf", args: [addr] },
      ],
    });
    stremeBal = streme.status === "success" ? (streme.result as bigint) : 0n;
    const poolBal = pool.status === "success" ? (pool.result as bigint) : 0n;
    const funderBal = funder.status === "success" ? (funder.result as bigint) : 0n;
    stakedBal = poolBal > funderBal ? poolBal : funderBal;
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
