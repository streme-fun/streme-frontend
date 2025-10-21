import {
  fetchTokensFromStreme,
  enrichTokensWithData,
} from "@/src/lib/apiUtils";
import { NextRequest } from "next/server";
import { BLACKLISTED_TOKENS } from "@/src/lib/blacklist";

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

    const enrichedTokens = await enrichTokensWithData(tokens);

    // Filter out blacklisted tokens
    const filteredTokens = enrichedTokens.filter(
      (token) =>
        !BLACKLISTED_TOKENS.includes(
          token.contract_address?.toLowerCase() || ""
        )
    );

    const lastToken = tokens[tokens.length - 1];
    const nextPageTimestamp = lastToken?.timestamp?._seconds;

    // Debug final enriched tokens
    console.log(
      "Enriched tokens without creators:",
      filteredTokens.filter((t) => !t.creator).length
    );

    return Response.json(
      {
        data: filteredTokens,
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
