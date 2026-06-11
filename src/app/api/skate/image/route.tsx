// Dynamic OG card for /skate — when a player shares their run, the cast embed
// itself shows their score and dares friends to beat it.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { SKATE_DISPLAY_URL } from "../../../../lib/skateShare";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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
          // Synthwave night: deep indigo sky melting into a hot horizon
          background:
            "linear-gradient(180deg, #0c0626 0%, #221060 42%, #6d1f9e 60%, #ec4899 74%, #2b1854 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Neon street floor (Satori-safe: no 3D transforms / repeating gradients) */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 210,
            background:
              "linear-gradient(180deg, #1a0d3e 0%, #0a0520 100%)",
          }}
        />
        {/* Glowing waterline / street edge */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 210,
            height: 4,
            background: "#2dd4bf",
          }}
        />
        {/* A few receding neon grid lines */}
        {[40, 90, 150].map((b) => (
          <div
            key={b}
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              right: 0,
              bottom: b,
              height: 2,
              background: "rgba(45,212,191,0.28)",
            }}
          />
        ))}
        {/* Synthwave sun on the horizon */}
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 470,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              "linear-gradient(180deg, #fde68a 0%, #fb923c 40%, #ec4899 70%, #a855f7 100%)",
            opacity: 0.85,
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
                  {by ? `@${by} dares you to beat it` : "Can you beat this line?"}
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
                    #{rank} on the leaderboard
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
                <div
                  style={{
                    display: "flex",
                    fontSize: 38,
                    color: "#f5d0fe",
                    marginTop: 10,
                  }}
                >
                  Ollie · flip · grind · stack combos
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
                color: "#c4b5fd",
              }}
            >
              <div style={{ display: "flex", width: 26, height: 10, background: "#6366f1", borderRadius: 4 }} />
              <div style={{ display: "flex", width: 26, height: 10, background: "#ec4899", borderRadius: 4 }} />
              <div style={{ display: "flex", width: 26, height: 10, background: "#2dd4bf", borderRadius: 4 }} />
              {SKATE_DISPLAY_URL}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${baseUrl}/surf/monster.png`}
            width={360}
            height={360}
            alt=""
            style={{ transform: "rotate(-12deg)" }}
          />
        </div>
      </div>
    ),
    { width: 1200, height: 800 }
  );
}
