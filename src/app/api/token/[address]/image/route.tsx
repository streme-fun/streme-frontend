import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;

  console.log(`[Image Gen] Starting generation for token: ${address}`);

  try {
    // Determine the base URL more reliably
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    console.log(`[Image Gen] Base URL: ${baseUrl}`);

    // Fetch token data with better error handling
    const tokenApiUrl = `${baseUrl}/api/tokens/single?address=${address}`;
    console.log(`[Image Gen] Fetching: ${tokenApiUrl}`);

    const tokenResponse = await fetch(tokenApiUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Streme-Image-Generator/1.0",
        Accept: "application/json",
      },
    });

    console.log(`[Image Gen] API Response status: ${tokenResponse.status}`);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(
        `[Image Gen] API Error: ${tokenResponse.status} - ${errorText}`
      );
      throw new Error(`API returned ${tokenResponse.status}: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log(`[Image Gen] Token data received:`, {
      hasData: !!tokenData.data,
      name: tokenData.data?.name,
      symbol: tokenData.data?.symbol,
    });

    const token = tokenData.data;

    if (!token) {
      console.error("[Image Gen] No token data in response");
      throw new Error("No token data found");
    }

    console.log(
      `[Image Gen] Generating image for: ${token.name} (${token.symbol})`
    );

    // Create the image response
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white",
            fontFamily: "system-ui, -apple-system, sans-serif",
            position: "relative",
            backgroundImage: `url(${baseUrl}/stream.gif)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Token Image */}
          {token.img_url ? (
            <img
              src={token.img_url}
              alt={token.name}
              width="400"
              height="400"
              style={{
                borderRadius: "40px",
                objectFit: "cover",
                position: "relative",
                zIndex: 1,
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              }}
            />
          ) : (
            <div
              style={{
                width: "400px",
                height: "400px",
                backgroundColor: "#f8fafc",
                borderRadius: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "120px",
                fontWeight: "bold",
                color: "#64748b",
                fontFamily: "monospace",
                border: "4px solid #e2e8f0",
                position: "relative",
                zIndex: 1,
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              }}
            >
              {token.symbol?.[0] ?? "?"}
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          "Cache-Control": "public, immutable, no-transform, max-age=300",
          "Content-Type": "image/png",
        },
      }
    );

    console.log(`[Image Gen] Image generated successfully`);
    return imageResponse;
  } catch (error) {
    console.error("[Image Gen] Error:", error);

    // Return a plain error response for debugging
    return new NextResponse(
      `Image generation error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );
  }
}
