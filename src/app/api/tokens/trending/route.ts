import { SPAMMER_BLACKLIST } from "@/src/lib/blacklist";

interface TrendingToken {
  username?: string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    const headers = {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600", // Cache for 5 minutes
    };

    // Fetch trending tokens from the external API
    const response = await fetch("https://api.streme.fun/api/tokens/trending", {
      headers: {
        Accept: "application/json",
        "User-Agent": "Streme/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `External API error: ${response.status} ${response.statusText}`
      );
    }

    const trendingData: TrendingToken[] = await response.json();

    // Filter out blacklisted tokens and tokens with $ in name/symbol
    const filteredData = trendingData.filter((token) => {
      if (token.username) {
        const username = token.username.toLowerCase();
        const isBlacklisted = SPAMMER_BLACKLIST.includes(username);
        if (isBlacklisted) return false;
      }
      
      // Filter out tokens with $ in name or symbol
      if (token.name && token.name.includes('$')) {
        return false;
      }
      if (token.symbol && token.symbol.includes('$')) {
        return false;
      }
      
      return true;
    });

    return Response.json(filteredData, { headers });
  } catch (error) {
    console.error("Error fetching trending tokens:", error);
    return Response.json(
      {
        error: "Failed to fetch trending tokens",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
