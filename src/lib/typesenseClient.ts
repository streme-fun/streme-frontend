import Typesense from "typesense";
import { Token } from "../app/types/token";

// Server-side only - these env vars should NOT have NEXT_PUBLIC_ prefix
const apiKey = process.env.TYPESENSE_API_KEY;
const host = process.env.TYPESENSE_HOST || "api.streme.fun";
const port = process.env.TYPESENSE_PORT || "443";
const protocol = process.env.TYPESENSE_PROTOCOL || "https";

if (!apiKey) {
  console.warn("TYPESENSE_API_KEY is not set (server-side only)");
}

export const typesenseClient = new Typesense.Client({
  apiKey: apiKey || "",
  nodes: [
    {
      host,
      port: parseInt(port),
      protocol,
    },
  ],
  connectionTimeoutSeconds: 10,
  retryIntervalSeconds: 1,
});

export interface TypesenseToken {
  id: string;
  name: string;
  symbol: string;
  contract_address: string;
  deployer: string;
  requestor_fid: number;
  username: string;
  type: string;
  chain_id: number;
  market_cap: number;
  volume: number;
  timestamp: number;
  img_url?: string;
  pfp_url?: string;
}

// Convert Typesense token to Token format for UI
export function convertTypesenseTokenToToken(
  tsToken: TypesenseToken
): Token {
  return {
    id: 0, // Not available from Typesense
    created_at: new Date(tsToken.timestamp * 1000).toISOString(),
    tx_hash: "", // Not available
    contract_address: tsToken.contract_address,
    requestor_fid: tsToken.requestor_fid,
    name: tsToken.name,
    symbol: tsToken.symbol,
    img_url: tsToken.img_url || "",
    pool_address: "", // Not available
    cast_hash: "", // Not available
    type: tsToken.type,
    pair: "", // Not available
    chain_id: tsToken.chain_id,
    metadata: {},
    profileImage: null,
    pool_id: "",
    staking_pool: "",
    staking_address: "",
    pfp_url: tsToken.pfp_url || "",
    username: tsToken.username,
    timestamp: {
      _seconds: Math.floor(tsToken.timestamp),
      _nanoseconds: 0,
    },
    marketData: {
      marketCap: tsToken.market_cap,
      price: 0,
      priceChange1h: 0,
      priceChange24h: 0,
      priceChange5m: 0,
      volume24h: tsToken.volume,
      lastUpdated: {
        _seconds: Math.floor(Date.now() / 1000),
        _nanoseconds: 0,
      },
    },
    creator: {
      name: tsToken.username,
      score: 0,
      recasts: 0,
      likes: 0,
      profileImage: tsToken.pfp_url || "",
    },
  };
}

export async function searchTokens(
  query: string,
  limit = 20
): Promise<TypesenseToken[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    // Use backend proxy to avoid CORS issues
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`
    );

    if (!response.ok) {
      console.error("Search API error:", response.status);
      return [];
    }

    const tokens = await response.json();
    return tokens as TypesenseToken[];
  } catch (error) {
    console.error("Error searching tokens:", error);
    return [];
  }
}
