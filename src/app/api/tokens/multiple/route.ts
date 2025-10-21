import { NextRequest, NextResponse } from "next/server";
import { fetchTokenFromStreme } from "@/src/lib/apiUtils";
import { BLACKLISTED_TOKENS } from "@/src/lib/blacklist";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenAddresses } = body;

    if (!tokenAddresses || !Array.isArray(tokenAddresses)) {
      return NextResponse.json(
        { error: "tokenAddresses array is required" },
        { status: 400 }
      );
    }

    if (tokenAddresses.length === 0) {
      return NextResponse.json({ tokens: [] });
    }

    // Limit to 30 addresses per request to avoid overwhelming the API
    if (tokenAddresses.length > 30) {
      return NextResponse.json(
        { error: "Maximum 30 addresses per request" },
        { status: 400 }
      );
    }

    // Normalize addresses to lowercase
    const normalizedAddresses = tokenAddresses.map(addr => addr.toLowerCase());

    // Filter out blacklisted addresses
    const allowedAddresses = normalizedAddresses.filter(
      (address) => !BLACKLISTED_TOKENS.includes(address)
    );

    // Fetch all tokens in parallel
    const tokenPromises = allowedAddresses.map(async (address) => {
      try {
        const tokenData = await fetchTokenFromStreme(address);
        return tokenData;
      } catch (error) {
        console.warn(`Failed to fetch token ${address}:`, error);
        return null;
      }
    });

    const tokens = await Promise.all(tokenPromises);

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("Error fetching multiple tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}