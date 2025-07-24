import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Neynar API key not configured" }, { status: 500 });
    }

    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(query)}&limit=10`,
      {
        headers: {
          "api_key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the response to match our expected format
    interface NeynarUser {
      fid: number;
      username: string;
      display_name?: string;
      pfp_url: string;
      follower_count?: number;
      following_count?: number;
      verified_addresses?: { eth_addresses: string[] };
    }
    
    const users = data.result?.users?.map((user: NeynarUser) => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name || user.username,
      pfpUrl: user.pfp_url,
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      verifiedEthAddresses: user.verified_addresses?.eth_addresses || [],
    })) || [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Search users error:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}