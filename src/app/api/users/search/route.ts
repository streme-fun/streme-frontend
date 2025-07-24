import { NextRequest, NextResponse } from "next/server";
import { getNeynarClient } from "@/src/lib/neynar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limitParam = searchParams.get("limit");
  
  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 100) : 10;

  try {
    const client = getNeynarClient();
    
    // Use Neynar's searchUser method
    const response = await client.searchUser({
      q: query.trim(),
      limit,
    });

    // Filter and format the response to only include necessary fields
    const users = response.result.users.map((user) => ({
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      custody_address: user.custody_address,
      verified_addresses: user.verified_addresses,
      follower_count: user.follower_count,
      following_count: user.following_count,
    }));

    return NextResponse.json({
      success: true,
      data: {
        users,
        next: response.result.next,
      },
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}