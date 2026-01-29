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

    // Extract cache-busting parameter from URL (if present)
    const url = new URL(request.url);
    const cacheParam = url.searchParams.get('v');

    // Build API URL with cache-busting parameter
    const apiUrl = new URL(`https://api.streme.fun/api/stakers/${tokenAddress}`);
    if (cacheParam) {
      apiUrl.searchParams.set('v', cacheParam);
    }

    // Fetch from the external Streme API
    const response = await fetch(apiUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Streme/1.0",
      },
    });

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
    console.error(
      "Error fetching stakers:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      { error: "Failed to fetch stakers" },
      { status: 500 }
    );
  }
}