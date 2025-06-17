export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenAddress: string }> }
) {
  try {
    const { tokenAddress } = await params;

    if (!tokenAddress) {
      return Response.json(
        { error: "Token address is required" },
        { status: 400 }
      );
    }

    // Fetch from the external Streme API
    const response = await fetch(
      `https://api.streme.fun/api/token/${tokenAddress}/stakers`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Streme/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const data = await response.json();

    // Return the data with appropriate headers
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error("Error fetching stakers:", error);
    return Response.json(
      {
        error: "Failed to fetch stakers",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}