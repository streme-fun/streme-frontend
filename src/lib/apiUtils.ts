import { Token } from "@/src/app/types/token";

export async function fetchTokensFromStreme(
  before?: number,
  limit: number = 200
): Promise<Token[]> {
  try {
    const params = new URLSearchParams();
    if (before) params.append("before", before.toString());
    if (limit) params.append("limit", limit.toString());

    const queryString = params.toString();
    const url = `https://api.streme.fun/api/tokens${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await fetch(url, {
      cache: "no-store",
    });
    const tokens = await response.json();
    // Return the tokens array directly if it's not wrapped in data
    return Array.isArray(tokens) ? tokens : tokens.data || [];
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return [];
  }
}

type EnrichedToken = Omit<Token, "creator"> & {
  creator?: {
    name: string;
    score: number;
    recasts: number;
    likes: number;
    profileImage: string;
  };
};

export async function enrichTokensWithData(
  tokens: Token[]
): Promise<EnrichedToken[]> {
  if (!Array.isArray(tokens)) {
    console.error("Expected tokens array, got:", tokens);
    return [];
  }

  // Transform tokens and use only market data from Streme API
  const enrichedTokens = tokens.map((token) => ({
    ...token,
    creator: token.requestor_fid
      ? {
          name: token.username || "Unknown",
          score: 0,
          recasts: 0,
          likes: 0,
          profileImage: token.pfp_url || "",
        }
      : undefined,
    // Use market data from Streme API only
    price: token.marketData?.price,
    marketCap: token.marketData?.marketCap,
    volume24h: token.marketData?.volume24h,
    change1h: token.marketData?.priceChange1h,
    change24h: token.marketData?.priceChange24h,
  })) as EnrichedToken[];

  return enrichedTokens;
}

export async function fetchTokenFromStreme(
  address: string
): Promise<Token | null> {
  if (!address) {
    console.error("No address provided to fetchTokenFromStreme");
    return null;
  }

  try {
    const normalizedAddress = address.toLowerCase();
    console.log("Fetching token data for:", normalizedAddress);

    // Add timeout to external API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://api.streme.fun/token/${normalizedAddress}`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Streme.fun/1.0",
        },
      }
    ).finally(() => {
      clearTimeout(timeoutId);
    });

    console.log(`External API response status: ${response.status}`);

    // Handle different response statuses more explicitly
    if (response.status >= 500) {
      throw new Error(
        `External service unavailable (status: ${response.status})`
      );
    }

    if (response.status === 429) {
      throw new Error(`Rate limited by external service`);
    }

    if (!response.ok) {
      console.warn(`External API returned status ${response.status}`);
      return null;
    }

    const tokenJson = await response.json();
    console.log("Raw token response:", tokenJson);

    if (tokenJson.message === "No such document!" || tokenJson.errors) {
      console.error("Token fetch failed:", {
        status: response.status,
        data: tokenJson,
      });
      return null;
    }

    // Check if we have actual token data
    const token = tokenJson.data ? tokenJson.data : tokenJson;
    if (!token.contract_address) {
      console.error("Invalid token data received:", token);
      return null;
    }

    return token;
  } catch (error) {
    console.error("Error fetching token:", error);

    // Re-throw errors that indicate service issues so they can be retried
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("External service timeout");
      }
      if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        throw new Error("Network error connecting to external service");
      }
      if (
        error.message.includes("service unavailable") ||
        error.message.includes("503")
      ) {
        throw error; // Re-throw service unavailable errors
      }
    }

    // For other errors, return null (token not found, etc.)
    return null;
  }
}
