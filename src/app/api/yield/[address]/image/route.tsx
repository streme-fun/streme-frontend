// Dynamic OG card for /yield/[address] — the "flex my stream" share image.
// Every staker who shares becomes an advertiser for the streaming primitive.

import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface FlowData {
  symbol: string;
  tokensPerDay: number;
  usdPerDay: number | null;
}

function fmtAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (value >= 1) return value.toFixed(value >= 100 ? 0 : 1);
  return value.toPrecision(2);
}

function fmtUsd(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(2)}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;

  try {
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    let flows: FlowData[] = [];
    let username: string | null = null;
    let pfpUrl: string | null = null;

    try {
      const [yieldRes, userRes] = await Promise.all([
        fetch(`${baseUrl}/api/yield/${address}`, { cache: "no-store" }),
        fetch(`${baseUrl}/api/users/by-address?address=${address}`, {
          cache: "no-store",
        }),
      ]);
      if (yieldRes.ok) {
        const data = await yieldRes.json();
        flows = (data?.flows ?? []).slice(0, 3);
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        const user = userData?.data?.[0] ?? userData?.user;
        username = user?.username ?? null;
        pfpUrl = user?.pfp_url ?? null;
      }
    } catch {
      // Render the branded card without data rather than failing.
    }

    const hero = flows[0];
    const others = flows.slice(1);
    const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background:
              "linear-gradient(135deg, #0b1020 0%, #131a35 55%, #0c2b25 100%)",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {pfpUrl && (
                <img
                  src={pfpUrl}
                  alt=""
                  width="72"
                  height="72"
                  style={{
                    borderRadius: 9999,
                    border: "3px solid rgba(255,255,255,0.25)",
                    objectFit: "cover",
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>
                  {username ? `@${username}` : shortAddress}
                </div>
                <div
                  style={{ display: "flex", fontSize: 24, color: "#8ea0ff" }}
                >
                  is earning streaming rewards
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                width: 28,
                height: 28,
                borderRadius: 9999,
                backgroundColor: "#46e3b7",
                boxShadow: "0 0 40px 12px rgba(70,227,183,0.45)",
              }}
            />
          </div>

          {hero ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 96,
                    fontWeight: 800,
                    color: "#46e3b7",
                    letterSpacing: "-3px",
                  }}
                >
                  +{fmtAmount(hero.tokensPerDay)} ${hero.symbol}
                </div>
              </div>
              <div
                style={{ display: "flex", fontSize: 36, color: "#c3cbf5" }}
              >
                per day, streamed every second
                {hero.usdPerDay && hero.usdPerDay >= 0.01
                  ? ` · ~${fmtUsd(hero.usdPerDay)}/day`
                  : ""}
              </div>
              {others.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 28,
                    color: "#8ea0ff",
                    marginTop: 12,
                  }}
                >
                  also streaming{" "}
                  {others
                    .map((f) => `+${fmtAmount(f.tokensPerDay)} $${f.symbol}`)
                    .join(" · ")}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{ display: "flex", fontSize: 48, color: "#c3cbf5" }}
            >
              Stake any Streme token to start a reward stream
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 28,
              color: "#8ea0ff",
            }}
          >
            <div style={{ display: "flex" }}>
              stake early, earn the stream
            </div>
            <div style={{ display: "flex", fontWeight: 700, color: "#ffffff" }}>
              streme.fun
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          "Content-Type": "image/png",
        },
      }
    );
  } catch (error) {
    console.error("[Yield Image] Error:", error);
    return new NextResponse("Yield image generation error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
