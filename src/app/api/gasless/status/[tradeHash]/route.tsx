import { type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tradeHash: string }> }
) {
  try {
    const { tradeHash } = await params;
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get("chainId") || "8453"; // Default to Base

    const res = await fetch(
      `https://api.0x.org/gasless/status/${tradeHash}?chainId=${chainId}`,
      {
        headers: {
          "0x-api-key": process.env.ZEROX_API_KEY as string,
          "0x-version": "v2",
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.text();
      console.error("0x Gasless API status error:", res.status, errorData);
      return Response.json(
        { error: `0x Gasless API error: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    console.log(
      `gasless status for ${tradeHash}:`,
      JSON.stringify(data, null, 2)
    );

    return Response.json(data);
  } catch (error) {
    console.error("Gasless status API error:", error);
    return Response.json(
      { error: "Failed to fetch gasless status" },
      { status: 500 }
    );
  }
}
