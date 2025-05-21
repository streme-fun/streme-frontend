import {
  fetchTokensFromStreme,
  enrichTokensWithData,
} from "@/src/lib/apiUtils";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const before = searchParams.get("before");
    const limit = parseInt(searchParams.get("limit") || "200");

    const headers = {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    };

    const tokens = await fetchTokensFromStreme(
      before ? parseInt(before) : undefined,
      limit
    );

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

    const enrichedTokens = await enrichTokensWithData(tokens);

    // Get the timestamp of the last token for next page
    const lastToken = tokens[tokens.length - 1];
    const nextPageTimestamp = lastToken?.timestamp?._seconds;

    // Debug final enriched tokens
    console.log(
      "Enriched tokens without creators:",
      enrichedTokens.filter((t) => !t.creator).length
    );

    return Response.json(
      {
        data: enrichedTokens,
        hasMore: tokens.length === limit,
        nextPage: nextPageTimestamp,
      },
      { headers }
    );
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
