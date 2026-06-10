// Dynamic OG card for /pulse — used by the daily pulse cast embed and any
// share of the page. Typographic by design: no remote token images means no
// broken renders, and live numbers are the visual.

import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface PulseImageToken {
  symbol: string;
  marketCap: number;
  volume24h: number;
  change24h: number;
  totalStakers?: number;
}

function fmtUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : value.toFixed(1);
  return `${value >= 0 ? "+" : ""}${rounded}%`;
}

export async function GET(request: NextRequest) {
  try {
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    let tokens: PulseImageToken[] = [];
    let totalVolume = 0;
    let activeTokens = 0;
    try {
      const response = await fetch(`${baseUrl}/api/pulse`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        tokens = (data?.snapshot?.tokens ?? []).slice(0, 3);
        totalVolume = data?.snapshot?.totals?.volume24h ?? 0;
        activeTokens = data?.snapshot?.totals?.activeTokens24h ?? 0;
      }
    } catch {
      // Render the branded card without data rather than failing.
    }

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
              "linear-gradient(135deg, #0b1020 0%, #131a35 55%, #1b1040 100%)",
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
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 64,
                  fontWeight: 800,
                  letterSpacing: "-2px",
                }}
              >
                STREME PULSE
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  color: "#8ea0ff",
                  marginTop: 8,
                }}
              >
                tokens streaming staking rewards, every second
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

          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {tokens.map((token, i) => (
              <div
                key={token.symbol + i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 32px",
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "24px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 36,
                      fontWeight: 700,
                      color: "#8ea0ff",
                      width: 48,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>
                    ${token.symbol}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "36px" }}
                >
                  <div style={{ display: "flex", fontSize: 32, color: "#c3cbf5" }}>
                    {fmtUsd(token.volume24h)} vol
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 32,
                      fontWeight: 700,
                      color: token.change24h >= 0 ? "#46e3b7" : "#ff7e9d",
                    }}
                  >
                    {fmtPct(token.change24h)}
                  </div>
                </div>
              </div>
            ))}
            {tokens.length === 0 && (
              <div
                style={{
                  display: "flex",
                  fontSize: 40,
                  color: "#c3cbf5",
                  padding: "24px 0",
                }}
              >
                Live rankings of every streaming token on Base
              </div>
            )}
          </div>

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
              {activeTokens > 0
                ? `${activeTokens} tokens active · ${fmtUsd(
                    totalVolume
                  )} 24h volume`
                : "Launch · Stake · Stream"}
            </div>
            <div style={{ display: "flex", fontWeight: 700, color: "#ffffff" }}>
              streme.fun/pulse
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
    console.error("[Pulse Image] Error:", error);
    return new NextResponse("Pulse image generation error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
