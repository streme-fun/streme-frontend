import {
  fetchTokensFromStreme,
  fetchCreatorProfiles,
  enrichTokensWithData,
} from "@/app/lib/apiUtils";

export async function GET() {
  try {
    const headers = {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    };

    const tokens = await fetchTokensFromStreme();

    const creatorIds = [
      ...new Set(tokens.map((token) => token.requestor_fid?.toString())),
    ].filter(Boolean);

    const creatorProfiles = await fetchCreatorProfiles(creatorIds);
    const enrichedTokens = await enrichTokensWithData(tokens, creatorProfiles);

    return Response.json({ data: enrichedTokens }, { headers });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return Response.json(
      {
        error: "Failed to fetch tokens",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
