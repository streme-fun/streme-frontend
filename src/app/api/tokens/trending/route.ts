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

    return Response.json(trendingData, { headers });
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
