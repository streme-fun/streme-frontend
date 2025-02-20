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

    // Debug initial tokens
    console.log("Initial tokens count:", tokens.length);
    console.log(
      "Tokens without requestor_fid:",
      tokens
        .filter((t) => !t.requestor_fid)
        .map((t) => ({
          name: t.name,
          symbol: t.symbol,
          address: t.contract_address,
        }))
    );

    const creatorIds = [
      ...new Set(tokens.map((token) => token.requestor_fid?.toString())),
    ].filter(Boolean);

    // Debug creator IDs
    console.log("Unique creator IDs:", creatorIds.length);

    const creatorProfiles = await fetchCreatorProfiles(creatorIds);

    // Debug creator profiles
    console.log(
      "Creator profiles fetched:",
      Object.keys(creatorProfiles).length
    );
    console.log(
      "Missing creator profiles:",
      creatorIds.filter((id) => !creatorProfiles[id])
    );

    const enrichedTokens = await enrichTokensWithData(tokens, creatorProfiles);

    // Debug final enriched tokens
    console.log(
      "Enriched tokens without creators:",
      enrichedTokens.filter((t) => !t.creator).length
    );

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
