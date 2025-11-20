import Typesense from "typesense";

const apiKey = process.env.NEXT_PUBLIC_TYPESENSE_API_KEY;
const host = process.env.NEXT_PUBLIC_TYPESENSE_HOST || "api.streme.fun";
const port = process.env.NEXT_PUBLIC_TYPESENSE_PORT || "443";
const protocol = process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || "https";

if (!apiKey) {
  console.warn("NEXT_PUBLIC_TYPESENSE_API_KEY is not set");
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
}

export async function searchTokens(
  query: string,
  limit = 20
): Promise<TypesenseToken[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const searchParams = {
      q: query.trim(),
      query_by: "name,symbol,username,contract_address",
      limit,
      per_page: limit,
    };

    const results = await typesenseClient
      .collections("tokens")
      .documents()
      .search(searchParams);

    if (results.hits) {
      return results.hits.map((hit) => hit.document as TypesenseToken);
    }

    return [];
  } catch (error) {
    console.error("Error searching tokens:", error);
    return [];
  }
}

export async function getTokenById(
  contractAddress: string
): Promise<TypesenseToken | null> {
  try {
    const results = await typesenseClient
      .collections("tokens")
      .documents()
      .search({
        q: contractAddress,
        query_by: "contract_address",
        limit: 1,
      });

    if (results.hits && results.hits.length > 0) {
      return results.hits[0].document as TypesenseToken;
    }

    return null;
  } catch (error) {
    console.error("Error fetching token:", error);
    return null;
  }
}
