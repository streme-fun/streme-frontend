import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      {
        headers: {
          Accept: "application/json",
        },
        // Add cache control
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      console.error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to fetch ETH price", status: response.status },
        {
          status: response.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    const data = await response.json();

    if (!data?.ethereum?.usd) {
      console.error("Invalid ETH price data from CoinGecko");
      return NextResponse.json(
        { error: "Invalid ETH price data" },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    return NextResponse.json(
      {
        eth: data.ethereum.usd,
        timestamp: Date.now(),
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          // Cache for 1 minute
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("ETH price API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ETH price" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
