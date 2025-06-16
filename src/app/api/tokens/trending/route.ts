import { SPAMMER_BLACKLIST } from "@/src/lib/blacklist";

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

    const trendingData = await response.json();

    // Filter out blacklisted tokens
    const filteredData = trendingData.filter((token: any) => {
      if (token.username) {
        const username = token.username.toLowerCase();
        const isBlacklisted = SPAMMER_BLACKLIST.includes(username);
        if (isBlacklisted) {
          console.log(`[Trending API] Filtering out blacklisted token from creator: ${username}`);
        }
        return !isBlacklisted;
      }
      return true;
    });

    console.log(`[Trending API] Filtered ${trendingData.length - filteredData.length} blacklisted tokens`);

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
