import {
  fetchTokensFromStreme,
  fetchCreatorProfiles,
  enrichTokensWithData,
} from "@/app/lib/apiUtils";

export async function GET() {
  try {
    // Add cache control headers
    const headers = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    };

    // Fetch tokens
    const allTokens = await fetchTokensFromStreme();
    // Take only first 10 tokens for debugging
    const tokens = allTokens.slice(0, 10);

    // Get unique creator IDs
    const creatorIds = [
      ...new Set(tokens.map((token) => token.requestor_fid?.toString())),
    ].filter(Boolean);

    // Fetch creator profiles
    const creatorProfiles = await fetchCreatorProfiles(creatorIds);

    // Enrich tokens with all data
    const enrichedTokens = await enrichTokensWithData(tokens, creatorProfiles);

    return Response.json({ data: enrichedTokens }, { headers });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return Response.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}
