import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

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

    // Format price for display
    const formatPrice = (price: number | undefined) => {
      if (!price || isNaN(price)) return "-";

      if (price < 0.01 && price > 0) {
        const decimalStr = price.toFixed(20).split(".")[1];
        let zeroCount = 0;
        while (decimalStr[zeroCount] === "0") {
          zeroCount++;
        }
        return `$0.0${zeroCount}${decimalStr.slice(zeroCount, zeroCount + 4)}`;
      }

      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })}`;
    };

    // Format market cap
    const formatCurrency = (value: number | undefined) => {
      if (!value || isNaN(value)) return "-";
      return `$${value.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`;
    };

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
            padding: "60px",
          }}
        >
          {/* Streme branding in top left */}
          <div
            style={{
              position: "absolute",
              top: "40px",
              left: "40px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: "bold",
                color: "#111827",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  backgroundColor: "#3b82f6",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: "bold",
                }}
              >
                S
              </div>
              streme.fun
            </div>
          </div>

          {/* Token logo - front and center */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "32px",
              marginTop: "-40px",
            }}
          >
            {/* Token Image */}
            {token.img_url ? (
              <img
                src={token.img_url}
                alt={token.name}
                width="200"
                height="200"
                style={{
                  borderRadius: "32px",
                  objectFit: "cover",
                  border: "6px solid #f3f4f6",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.1)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "200px",
                  height: "200px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "80px",
                  fontWeight: "bold",
                  color: "#64748b",
                  fontFamily: "monospace",
                  border: "6px solid #e2e8f0",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.1)",
                }}
              >
                {token.symbol?.[0] ?? "?"}
              </div>
            )}

            {/* Token Info */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                textAlign: "center",
              }}
            >
              <h1
                style={{
                  fontSize: "52px",
                  fontWeight: "bold",
                  margin: 0,
                  color: "#111827",
                  lineHeight: 1.1,
                }}
              >
                {token.name}
              </h1>

              <div
                style={{
                  fontSize: "36px",
                  color: "#64748b",
                  margin: 0,
                  fontFamily: "monospace",
                  fontWeight: "600",
                }}
              >
                ${token.symbol}
              </div>

              {/* Price and Market Cap */}
              <div
                style={{
                  display: "flex",
                  gap: "64px",
                  alignItems: "center",
                  marginTop: "32px",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "20px",
                      color: "#64748b",
                      margin: 0,
                      fontWeight: "500",
                    }}
                  >
                    Price
                  </div>
                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: "bold",
                      color: "#111827",
                      fontFamily: "monospace",
                      margin: 0,
                    }}
                  >
                    {formatPrice(token.price)}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "20px",
                      color: "#64748b",
                      margin: 0,
                      fontWeight: "500",
                    }}
                  >
                    Market Cap
                  </div>
                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: "bold",
                      color: "#111827",
                      fontFamily: "monospace",
                      margin: 0,
                    }}
                  >
                    {formatCurrency(token.marketCap)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Creator info at bottom */}
          {token.creator && (
            <div
              style={{
                position: "absolute",
                bottom: "40px",
                right: "40px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                color: "#64748b",
                fontSize: "18px",
                fontWeight: "500",
              }}
            >
              <div>by @{token.creator.name}</div>
              {token.creator.profileImage && (
                <img
                  src={token.creator.profileImage}
                  alt={token.creator.name}
                  width="40"
                  height="40"
                  style={{
                    borderRadius: "20px",
                    border: "2px solid #e2e8f0",
                  }}
                />
              )}
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          // Use shorter cache for dynamic content as per docs
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
