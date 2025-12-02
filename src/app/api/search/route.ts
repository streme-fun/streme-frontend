import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = searchParams.get("limit") || "20";

  if (!query || !query.trim()) {
    return NextResponse.json([]);
  }

  try {
    const typesenseHost = process.env.TYPESENSE_HOST || "api.streme.fun";
    const typesenseApiKey = process.env.TYPESENSE_API_KEY;
    const typesensePort = process.env.TYPESENSE_PORT || "443";
    const typesenseProtocol = process.env.TYPESENSE_PROTOCOL || "https";

    if (!typesenseHost || !typesenseApiKey) {
      console.error("Missing Typesense credentials");
      return NextResponse.json(
        { error: "Search not configured" },
        { status: 500 }
      );
    }

    const searchParams = new URLSearchParams({
      q: query.trim(),
      query_by: "name,symbol,username,contract_address",
      limit: limit,
      per_page: limit,
    });

    const searchUrl = `${typesenseProtocol}://${typesenseHost}:${typesensePort}/collections/tokens/documents/search?${searchParams.toString()}`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "X-TYPESENSE-API-KEY": typesenseApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Typesense search error:", response.status, errorText);
      return NextResponse.json([], { status: 200 });
    }

    const results = await response.json();

    if (results.hits) {
      return NextResponse.json(
        results.hits.map((hit: { document: unknown }) => hit.document)
      );
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
