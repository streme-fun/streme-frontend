import { NextRequest, NextResponse } from "next/server";
import { createClient, Errors } from "@farcaster/quick-auth";
import {
  dailyEndsAt,
  dailyKey,
  dailyName,
  dailySeed,
  isDailyKey,
  prevDailyKey,
} from "../../../../lib/skateDaily";
import {
  getDailyBoard,
  submitDailyRun,
} from "../../../../lib/skateDailyBoard";

const MAX_SCORE = 100_000_000;
const MAX_COMBO = 50_000_000;
// a run that started before midnight UTC may finish just after — accept it
// onto the day it was actually skated for a short grace window
const ROLLOVER_GRACE_MS = 10 * 60 * 1000;

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

    const day = dailyKey();
    const board = await getDailyBoard(day, fid);
    return NextResponse.json(
      {
        day,
        name: dailyName(day),
        seed: dailySeed(day),
        endsAt: dailyEndsAt(day),
        ...board,
      },
      // attempt state must never go stale on the client — keep this uncached
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Skate daily GET error:", error);
    return NextResponse.json(
      { error: "Failed to load daily line" },
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
      day?: unknown;
      score?: unknown;
      combo?: unknown;
      username?: unknown;
      pfpUrl?: unknown;
      samples?: unknown;
    };

    const today = dailyKey();
    const claimedDay = typeof body.day === "string" ? body.day : today;
    if (!isDailyKey(claimedDay)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }
    const sinceMidnight = Date.now() - dailyEndsAt(prevDailyKey(today));
    const dayOk =
      claimedDay === today ||
      (claimedDay === prevDailyKey(today) && sinceMidnight < ROLLOVER_GRACE_MS);
    if (!dayOk) {
      return NextResponse.json(
        { error: "That line has reset — play today's" },
        { status: 409 }
      );
    }

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
    const samples = Array.isArray(body.samples)
      ? body.samples
          .slice(0, 1400)
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n))
      : [];

    const result = await submitDailyRun(
      claimedDay,
      { fid, username, pfpUrl, score, combo },
      samples
    );
    return NextResponse.json(
      { day: claimedDay, name: dailyName(claimedDay), ...result },
      { status: result.alreadyPlayed ? 409 : 200 }
    );
  } catch (error) {
    console.error("Skate daily POST error:", error);
    return NextResponse.json(
      { error: "Failed to submit daily run" },
      { status: 500 }
    );
  }
}
