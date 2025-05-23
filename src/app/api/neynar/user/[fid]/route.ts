import { NextRequest, NextResponse } from "next/server";
import { getNeynarUser } from "@/src/lib/neynar";

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

    const user = await getNeynarUser(fid);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      display_name: user.display_name,
      username: user.username,
      pfp_url: user.pfp_url,
      fid: user.fid,
    });
  } catch (error) {
    console.error("Error fetching Neynar user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
