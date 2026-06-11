import { NextRequest, NextResponse } from "next/server";
import { createClient, Errors } from "@farcaster/quick-auth";
import { getGhosts, saveGhost } from "../../../../lib/skateGhosts";

const MAX_SCORE = 100_000_000;

async function authenticateFid(request: NextRequest): Promise<number | null> {
  if (process.env.NODE_ENV !== "production") {
    const devFid = Number(request.headers.get("x-dev-fid"));
    if (Number.isInteger(devFid) && devFid > 0) return devFid;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  try {
    const client = createClient();
    const payload = await client.verifyJwt({
      token,
      domain: request.headers.get("host") || "streme.fun",
    });
    const fid = Number(payload.sub);
    return Number.isInteger(fid) && fid > 0 ? fid : null;
  } catch (e) {
    if (e instanceof Errors.InvalidTokenError) return null;
    throw e;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = Number(searchParams.get("fid"));
    const excludeFid =
      Number.isInteger(fidParam) && fidParam > 0 ? fidParam : undefined;
    const limitParam = Number(searchParams.get("limit"));
    const limit =
      Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 5
        ? limitParam
        : 4;
    const ghosts = await getGhosts(limit, excludeFid);
    return NextResponse.json(
      { ghosts },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Skate ghosts GET error:", error);
    return NextResponse.json({ error: "Failed to load ghosts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const fid = await authenticateFid(request);
    if (!fid) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    const body = (await request.json()) as {
      score?: unknown;
      username?: unknown;
      samples?: unknown;
    };
    const score = Math.floor(Number(body.score));
    if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }
    if (!Array.isArray(body.samples)) {
      return NextResponse.json({ error: "Invalid samples" }, { status: 400 });
    }
    const samples = body.samples
      .slice(0, 1400)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    const username =
      typeof body.username === "string" ? body.username.slice(0, 32) : "";

    await saveGhost({ fid, username, score, samples });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Skate ghosts POST error:", error);
    return NextResponse.json({ error: "Failed to save ghost" }, { status: 500 });
  }
}
