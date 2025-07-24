import { NextRequest, NextResponse } from "next/server";
import { getBestFriends } from "@/src/lib/neynar";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid: fidParam } = await params;
    const fid = parseInt(fidParam, 10);

    if (isNaN(fid)) {
      return NextResponse.json(
        { error: "Invalid FID provided" },
        { status: 400 }
      );
    }

    // Get limit from query params, default to 10, max 10
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(10, limitParam ? parseInt(limitParam, 10) : 10);

    const friends = await getBestFriends(fid, limit);

    return NextResponse.json({
      success: true,
      data: {
        fid,
        friends,
        count: friends.length,
      },
    });
  } catch (error) {
    console.error("Error fetching best friends:", error);
    return NextResponse.json(
      { error: "Failed to fetch best friends data" },
      { status: 500 }
    );
  }
}