// Dynamic OG card for /game — when a player shares their ride, the cast
// embed itself shows their distance and dares friends to beat it.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const { searchParams } = new URL(request.url);
  const distanceParam = Number(searchParams.get("d"));
  const distance =
    Number.isFinite(distanceParam) && distanceParam > 0
      ? Math.min(Math.floor(distanceParam), 1_000_000)
      : null;
  const byRaw = searchParams.get("by") ?? "";
  const by = /^[a-z0-9_.-]{1,32}$/i.test(byRaw) ? byRaw : null;
  const rankParam = Number(searchParams.get("r"));
  const rank =
    Number.isInteger(rankParam) && rankParam > 0 && rankParam <= 10_000
      ? rankParam
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
          padding: "60px 80px",
          background: "linear-gradient(135deg, #0a0f24 0%, #1b1340 55%, #2b1854 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: 2,
              color: "#67e8f9",
            }}
          >
            STREME SURF
          </div>
          {distance ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 150,
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.05,
                }}
              >
                {distance}m
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 40,
                  color: "#c7d2fe",
                  marginTop: 6,
                }}
              >
                {by ? `@${by} dares you to beat it` : "Can you beat this ride?"}
              </div>
              {rank && (
                <div
                  style={{
                    display: "flex",
                    alignSelf: "flex-start",
                    marginTop: 18,
                    padding: "10px 26px",
                    borderRadius: 999,
                    background: "rgba(103, 232, 249, 0.15)",
                    border: "2px solid #67e8f9",
                    fontSize: 34,
                    fontWeight: 700,
                    color: "#67e8f9",
                  }}
                >
                  🏆 #{rank} on the leaderboard
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 84,
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.1,
                }}
              >
                Ride the stream
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 38,
                  color: "#c7d2fe",
                  marginTop: 10,
                }}
              >
                Dodge rocks · pop bubbles · go far
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 24,
              fontSize: 30,
              color: "#818cf8",
            }}
          >
            <div style={{ display: "flex", width: 26, height: 10, background: "#6366f1", borderRadius: 4 }} />
            <div style={{ display: "flex", width: 26, height: 10, background: "#ec4899", borderRadius: 4 }} />
            <div style={{ display: "flex", width: 26, height: 10, background: "#2dd4bf", borderRadius: 4 }} />
            streme.fun/game
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${baseUrl}/game/monster.png`}
          width={380}
          height={380}
          alt=""
          style={{ transform: "scaleX(-1)" }}
        />
      </div>
    ),
    { width: 1200, height: 800 }
  );
}
