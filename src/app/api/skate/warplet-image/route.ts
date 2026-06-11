import { NextRequest, NextResponse } from "next/server";
import { fetchAsset, getWarpletImageUri } from "../../../../lib/warplets";

const CACHE = {
  "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
};

// Same-origin proxy for a Warplet's image (on-chain data URI or IPFS/https) so
// the game <canvas> can use it without tainting (and so <img> thumbnails work).
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

    // some Warplets embed the art on-chain as a data: URI
    if (imageUrl.startsWith("data:")) {
      const m = imageUrl.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
      if (!m) {
        return NextResponse.json({ error: "Bad data URI" }, { status: 502 });
      }
      const contentType = m[1] || "image/png";
      const body = m[2]
        ? Buffer.from(m[3], "base64")
        : Buffer.from(decodeURIComponent(m[3]), "utf-8");
      return new NextResponse(body, {
        headers: { "Content-Type": contentType, ...CACHE },
      });
    }

    // ipfs:// or https:// — fetch with multi-gateway fallback
    const res = await fetchAsset(imageUrl, "image/*");
    if (!res) {
      return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") || "image/png";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: { "Content-Type": contentType, ...CACHE },
    });
  } catch (error) {
    console.error("Warplet image error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
