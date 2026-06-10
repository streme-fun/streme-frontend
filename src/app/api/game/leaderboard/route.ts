import { NextRequest, NextResponse } from "next/server";
import { createClient, Errors } from "@farcaster/quick-auth";
import { getLeaderboard, submitScore } from "../../../../lib/gameLeaderboard";

const MAX_DISTANCE = 100_000;
const MAX_BUBBLES = 10_000;

/**
 * Resolve the caller's fid: Quick Auth JWT in production, with an
 * x-dev-fid header escape hatch for local development only.
 */
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
    const fid =
      Number.isInteger(fidParam) && fidParam > 0 ? fidParam : undefined;
    const data = await getLeaderboard(10, fid);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Game leaderboard GET error:", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const fid = await authenticateFid(request);
    if (!fid) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      distance?: unknown;
      bubbles?: unknown;
      username?: unknown;
      pfpUrl?: unknown;
    };

    const distance = Math.floor(Number(body.distance));
    if (!Number.isFinite(distance) || distance <= 0 || distance > MAX_DISTANCE) {
      return NextResponse.json({ error: "Invalid distance" }, { status: 400 });
    }
    const bubbles = Math.min(
      Math.max(Math.floor(Number(body.bubbles)) || 0, 0),
      MAX_BUBBLES
    );
    const username =
      typeof body.username === "string" ? body.username.slice(0, 32) : "";
    const pfpUrl =
      typeof body.pfpUrl === "string" && body.pfpUrl.startsWith("https://")
        ? body.pfpUrl.slice(0, 300)
        : "";

    const result = await submitScore({
      fid,
      username,
      pfpUrl,
      distance,
      bubbles,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Game leaderboard POST error:", error);
    return NextResponse.json(
      { error: "Failed to submit score" },
      { status: 500 }
    );
  }
}
