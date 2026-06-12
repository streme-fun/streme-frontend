// Dynamic OG card for /skate — when a player shares their run, the cast embed
// itself shows their score and dares friends to beat it.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { SKATE_DISPLAY_URL } from "../../../../lib/skateShare";
import {
  dailyName,
  formatDailyDate,
  isDailyKey,
} from "../../../../lib/skateDaily";

export const runtime = "edge";
// The render is a pure function of the query params (s / by / r / v), and the
// page meta stamps a per-deploy `v` token onto the URL, so a given URL is stable
// within a deploy. Let the CDN cache each URL (see Cache-Control below) instead
// of forcing a fresh ~1200×800 Satori render on every Farcaster / link scrape.

export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const { searchParams } = new URL(request.url);
  const scoreParam = Number(searchParams.get("s"));
  const score =
    Number.isFinite(scoreParam) && scoreParam > 0
      ? Math.min(Math.floor(scoreParam), 100_000_000)
      : null;
  const byRaw = searchParams.get("by") ?? "";
  const by = /^[a-z0-9_.-]{1,32}$/i.test(byRaw) ? byRaw : null;
  const rankParam = Number(searchParams.get("r"));
  const rank =
    Number.isInteger(rankParam) && rankParam > 0 && rankParam <= 10_000
      ? rankParam
      : null;
  const dayRaw = searchParams.get("d") ?? "";
  const day = isDailyKey(dayRaw) ? dayRaw : null;
  const streakParam = Number(searchParams.get("st"));
  const streak =
    day && Number.isInteger(streakParam) && streakParam > 1 && streakParam <= 999
      ? streakParam
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0c0626",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* In-game neon skate vista as the backdrop */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${baseUrl}/skate/og-bg.jpg`}
          width={1200}
          height={800}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 800,
            objectFit: "cover",
          }}
        />
        {/* Left-side scrim so the headline / score stays legible over the art */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 760,
            background:
              "linear-gradient(90deg, rgba(12,6,38,0.82) 0%, rgba(12,6,38,0.45) 55%, rgba(12,6,38,0) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "60px 80px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: 4,
                color: "#67e8f9",
                textShadow: "0 0 18px rgba(103,232,249,0.9)",
              }}
            >
              STREME SKATE
            </div>
            {day && (
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  alignItems: "center",
                  marginTop: 4,
                  padding: "8px 22px",
                  borderRadius: 999,
                  background: "rgba(253, 230, 138, 0.16)",
                  border: "2px solid #fde68a",
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: "#fde68a",
                }}
              >
                ⚡ DAILY LINE · {dailyName(day)} · {formatDailyDate(day)}
              </div>
            )}
            {score ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 138,
                    fontWeight: 800,
                    color: "#ffffff",
                    lineHeight: 1.02,
                    textShadow: "0 0 26px rgba(236,72,153,0.8)",
                  }}
                >
                  {score.toLocaleString()}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 40,
                    color: "#f5d0fe",
                    marginTop: 6,
                  }}
                >
                  {day
                    ? `${by ? `@${by}` : "Someone"} dares you — one shot a day`
                    : by
                    ? `@${by} dares you to beat it`
                    : "Can you beat this line?"}
                </div>
                {(rank || streak) && (
                  <div style={{ display: "flex", marginTop: 18, gap: 14 }}>
                    {rank && (
                      <div
                        style={{
                          display: "flex",
                          padding: "10px 26px",
                          borderRadius: 999,
                          background: "rgba(103, 232, 249, 0.15)",
                          border: "2px solid #67e8f9",
                          fontSize: 34,
                          fontWeight: 700,
                          color: "#67e8f9",
                        }}
                      >
                        #{rank} {day ? "today" : "on the leaderboard"}
                      </div>
                    )}
                    {streak && (
                      <div
                        style={{
                          display: "flex",
                          padding: "10px 26px",
                          borderRadius: 999,
                          background: "rgba(251, 146, 60, 0.15)",
                          border: "2px solid #fb923c",
                          fontSize: 34,
                          fontWeight: 700,
                          color: "#fb923c",
                        }}
                      >
                        🔥 {streak}-day streak
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 80,
                    fontWeight: 800,
                    color: "#ffffff",
                    lineHeight: 1.1,
                  }}
                >
                  Grind the stream
                </div>
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 24,
                fontSize: 30,
                color: "#c4b5fd",
              }}
            >
              {SKATE_DISPLAY_URL}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        // Cache hard at the CDN (each URL is deploy-stable thanks to the `v`
        // token) and serve stale while revalidating, so a deploy that changes
        // the card art naturally rolls in with the next scrape.
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
