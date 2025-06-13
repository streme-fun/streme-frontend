import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { addresses } = await request.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "Addresses array is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.error("NEYNAR_API_KEY is not configured");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    // Neynar API to fetch users by addresses
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addresses.join(
      ","
    )}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        api_key: apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Neynar API error:", response.status, response.statusText);
      return NextResponse.json(
        { error: "Failed to fetch from Neynar" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in Neynar bulk users API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
