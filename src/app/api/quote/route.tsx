import { type NextRequest } from "next/server";
import { isAddress } from "viem";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Validate required parameters
  const sellToken = searchParams.get("sellToken");
  const buyToken = searchParams.get("buyToken");
  const sellAmount = searchParams.get("sellAmount");
  const buyAmount = searchParams.get("buyAmount");
  const taker = searchParams.get("taker");
  const chainId = searchParams.get("chainId");

  // Validate sellToken
  if (!sellToken || !isAddress(sellToken)) {
    return Response.json(
      { error: "Invalid or missing sellToken address" },
      { status: 400 }
    );
  }

  // Validate buyToken
  if (!buyToken || !isAddress(buyToken)) {
    return Response.json(
      { error: "Invalid or missing buyToken address" },
      { status: 400 }
    );
  }

  // Validate either sellAmount or buyAmount is present and is a valid number string
  if (!sellAmount && !buyAmount) {
    return Response.json(
      { error: "Either sellAmount or buyAmount is required" },
      { status: 400 }
    );
  }

  if (sellAmount && !/^\d+$/.test(sellAmount)) {
    return Response.json(
      { error: "sellAmount must be a valid integer string" },
      { status: 400 }
    );
  }

  if (buyAmount && !/^\d+$/.test(buyAmount)) {
    return Response.json(
      { error: "buyAmount must be a valid integer string" },
      { status: 400 }
    );
  }

  // Validate taker address if present
  if (taker && !isAddress(taker)) {
    return Response.json(
      { error: "Invalid taker address" },
      { status: 400 }
    );
  }

  // Validate chainId if present
  if (chainId && !/^\d+$/.test(chainId)) {
    return Response.json(
      { error: "Invalid chainId" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://api.0x.org/swap/permit2/quote?${searchParams}`,
      {
        headers: {
          "0x-api-key": process.env.ZEROX_API_KEY as string,
          "0x-version": "v2",
        },
      }
    );

    if (!res.ok) {
      console.error("0x API quote error:", res.status);
      return Response.json(
        { error: `0x API error: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error(
      "Quote API error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      { error: "Failed to fetch quote data" },
      { status: 500 }
    );
  }
}
