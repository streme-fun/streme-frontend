import { NextRequest, NextResponse } from "next/server";
import { getWarpletEligibility } from "../../../../lib/warplets";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address") || "";
    if (!ADDR_RE.test(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    const data = await getWarpletEligibility(address);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Warplets GET error:", error);
    return NextResponse.json(
      { error: "Failed to check warplets" },
      { status: 500 }
    );
  }
}
