import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tokenAddress: string }> }
) {
  const { tokenAddress: address } = await context.params;

  console.log(`[Image Gen] Starting generation for token: ${address}`);

  try {
    // Determine the base URL more reliably
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    console.log(`[Image Gen] Base URL: ${baseUrl}`);

    // Fetch background image and convert to data URL
    const bgImageUrl = `${baseUrl}/og-light.png`;
    console.log(`[Image Gen] Background image URL: ${bgImageUrl}`);

    let backgroundDataUrl = null;
    try {
      const bgResponse = await fetch(bgImageUrl);
      console.log(
        `[Image Gen] Background image fetch status: ${bgResponse.status}`
      );

      if (bgResponse.ok) {
        const bgBuffer = await bgResponse.arrayBuffer();
        const bgBase64 = Buffer.from(bgBuffer).toString("base64");
        backgroundDataUrl = `data:image/png;base64,${bgBase64}`;
        console.log(
          `[Image Gen] Background image converted to data URL, length: ${backgroundDataUrl.length}`
        );
      } else {
        console.error(
          `[Image Gen] Background image fetch failed: ${bgResponse.status}`
        );
      }
    } catch (bgError) {
      console.error(`[Image Gen] Background image fetch error:`, bgError);
    }

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
    console.log(tokenData);
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

    console.log(
      `[Image Gen] Using background: ${
        backgroundDataUrl ? "data URL" : "fallback gradient"
      }`
    );

    // Create the image response with background
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
            fontFamily: "system-ui, -apple-system, sans-serif",
            backgroundColor: "#1a1a2e",
            backgroundImage: backgroundDataUrl
              ? `url(${backgroundDataUrl})`
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            gap: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            {/* Token Image */}
            {token.img_url && (
              <img
                src={token.img_url}
                alt={token.name}
                width="500"
                height="500"
                style={{
                  borderRadius: "10%",
                  objectFit: "cover",
                  backgroundColor: "white",
                  border: "4px solid rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
                }}
              />
            )}
          </div>
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
