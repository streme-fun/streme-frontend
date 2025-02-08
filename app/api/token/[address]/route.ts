import { NextResponse } from "next/server";
import { Token } from "@/app/types/token";
import { enrichTokenWithMarketData } from "@/app/lib/mockTokens";

export async function GET(
  request: Request,
  context: { params: { address: Promise<string> } }
) {
  try {
    const address = await context.params.address;
    const response = await fetch(
      `https://api.streme.fun/token/${address.toLowerCase()}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: response.status }
      );
    }

    const rawToken = await response.json();

    // Add decimals from the API response
    const token: Token = {
      ...rawToken,
      decimals: rawToken.decimals ?? 10, // Use API decimals or fallback to 10
    };

    // Enrich with market data
    const enrichedToken = enrichTokenWithMarketData(token, 0);

    return NextResponse.json(enrichedToken);
  } catch (error) {
    console.error("Error fetching token:", error);
    return NextResponse.json(
      { error: "Failed to fetch token data" },
      { status: 500 }
    );
  }
}
