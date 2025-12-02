import { NextRequest, NextResponse } from "next/server";
import { typesenseClient, TypesenseToken } from "@/src/lib/typesenseClient";
import { CROWDFUND_TOKEN_ADDRESSES } from "@/src/lib/crowdfundTokens";
import { SPAMMER_BLACKLIST, isAddressBlacklisted } from "@/src/lib/blacklist";
import { Token } from "@/src/app/types/token";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "36"), 100);
  const filter = searchParams.get("filter");

  // Validate sortBy parameter
  if (!sortBy || !["newest", "oldest", "marketCap"].includes(sortBy)) {
    return NextResponse.json(
      { error: "Invalid sortBy parameter. Must be: newest, oldest, or marketCap" },
      { status: 400 }
    );
  }

  // Check Typesense credentials
  const typesenseHost = process.env.TYPESENSE_HOST || "api.streme.fun";
  const typesenseApiKey = process.env.TYPESENSE_API_KEY;

  if (!typesenseHost || !typesenseApiKey) {
    console.error("Missing Typesense credentials");
    return NextResponse.json(
      { error: "Search service not configured" },
      { status: 500 }
    );
  }

  try {
    // Map sortBy to Typesense sort_by syntax
    const sortByMap: Record<string, string> = {
      newest: "timestamp:desc",
      oldest: "timestamp:asc",
      marketCap: "market_cap:desc",
    };

    const typesenseSortBy = sortByMap[sortBy];

    // Build search parameters
    const searchParamsObj: Record<string, string | number> = {
      q: "*", // Match all documents
      query_by: "name", // Required by Typesense even with q=*
      sort_by: typesenseSortBy,
      page: page,
      per_page: limit,
    };

    // Apply crowdfund filter if specified
    if (filter === "crowdfunds") {
      // Format: contract_address:=[addr1,addr2,...]
      const addresses = CROWDFUND_TOKEN_ADDRESSES.map((addr) =>
        addr.toLowerCase()
      ).join(",");
      searchParamsObj.filter_by = `contract_address:=[${addresses}]`;
    }

    // Call Typesense
    const results = await typesenseClient
      .collections("tokens")
      .documents()
      .search(searchParamsObj);

    if (!results.hits || results.hits.length === 0) {
      return NextResponse.json(
        {
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalResults: 0,
            hasMore: false,
          },
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        }
      );
    }

    // Convert Typesense results to Token format
    const rawTokens = results.hits.map((hit) => {
      const doc = hit.document as TypesenseToken;
      return {
        id: 0,
        created_at: new Date(doc.timestamp * 1000).toISOString(),
        tx_hash: "",
        contract_address: doc.contract_address,
        requestor_fid: doc.requestor_fid,
        name: doc.name,
        symbol: doc.symbol,
        img_url: doc.img_url || "",
        pool_address: "",
        cast_hash: "",
        type: doc.type,
        pair: "",
        chain_id: doc.chain_id,
        metadata: {},
        profileImage: null,
        pool_id: "",
        staking_pool: "",
        staking_address: "",
        pfp_url: doc.pfp_url || "",
        username: doc.username,
        timestamp: {
          _seconds: Math.floor(doc.timestamp),
          _nanoseconds: 0,
        },
        marketData: {
          marketCap: doc.market_cap || 0,
          price: 0,
          priceChange1h: 0,
          priceChange24h: 0,
          priceChange5m: 0,
          volume24h: doc.volume || 0,
          lastUpdated: {
            _seconds: Math.floor(Date.now() / 1000),
            _nanoseconds: 0,
          },
        },
        creator: {
          name: doc.username,
          score: 0,
          recasts: 0,
          likes: 0,
          profileImage: doc.pfp_url || "",
        },
        marketCap: doc.market_cap || 0,
        volume24h: doc.volume || 0,
      } as Token;
    });

    // Apply blacklist filtering
    const filteredTokens = rawTokens.filter((token) => {
      // Filter blacklisted addresses
      if (isAddressBlacklisted(token.contract_address, "token")) {
        return false;
      }

      // Filter spammer usernames
      if (
        token.username &&
        SPAMMER_BLACKLIST.includes(token.username.toLowerCase())
      ) {
        return false;
      }

      // Filter tokens with $ in name or symbol
      if (
        token.name?.includes("$") ||
        token.symbol?.includes("$")
      ) {
        return false;
      }

      return true;
    });

    // Calculate pagination metadata
    const totalResults = (results.found as number) || 0;
    const totalPages = Math.ceil(totalResults / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      {
        data: filteredTokens,
        pagination: {
          currentPage: page,
          totalPages,
          totalResults,
          hasMore,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Typesense sorting error:", error);
    return NextResponse.json(
      {
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalResults: 0,
          hasMore: false,
        },
      },
      {
        status: 200, // Return 200 with empty results to prevent UI errors
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  }
}
