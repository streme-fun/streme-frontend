import { NextRequest, NextResponse } from "next/server";
import { getWarpletImageUri } from "../../../../lib/warplets";

// Same-origin proxy for a Warplet's on-chain IPFS image so the game <canvas>
// can use it without tainting (and so <img> thumbnails work everywhere).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") || "";
    if (!/^\d{1,20}$/.test(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const imageUrl = await getWarpletImageUri(BigInt(token));
    if (!imageUrl) {
      return NextResponse.json({ error: "No image" }, { status: 404 });
    }
    const res = await fetch(imageUrl, {
      headers: { Accept: "image/*" },
      // gateways can be slow; let Next cache the result
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") || "image/png";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch (error) {
    console.error("Warplet image error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
