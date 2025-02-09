import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poolAddress = searchParams.get("poolAddress");

  if (!poolAddress) {
    return NextResponse.json(
      { error: "Pool address is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://app.geckoterminal.com/api/p1/base/pools/${poolAddress}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying GeckoTerminal request:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool data" },
      { status: 500 }
    );
  }
}
