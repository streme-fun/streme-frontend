import { NextRequest, NextResponse } from "next/server";
import { createClient, Errors } from "@farcaster/quick-auth";
import {
  getSkateLeaderboard,
  submitSkateScore,
} from "../../../../lib/skateLeaderboard";

const MAX_SCORE = 100_000_000;
const MAX_COMBO = 50_000_000;

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
    const data = await getSkateLeaderboard(25, fid);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Skate leaderboard GET error:", error);
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
      score?: unknown;
      combo?: unknown;
      username?: unknown;
      pfpUrl?: unknown;
    };

    const score = Math.floor(Number(body.score));
    if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }
    const combo = Math.min(
      Math.max(Math.floor(Number(body.combo)) || 0, 0),
      MAX_COMBO
    );
    const username =
      typeof body.username === "string" ? body.username.slice(0, 32) : "";
    const pfpUrl =
      typeof body.pfpUrl === "string" && body.pfpUrl.startsWith("https://")
        ? body.pfpUrl.slice(0, 300)
        : "";

    const result = await submitSkateScore({
      fid,
      username,
      pfpUrl,
      score,
      combo,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Skate leaderboard POST error:", error);
    return NextResponse.json(
      { error: "Failed to submit score" },
      { status: 500 }
    );
  }
}
