import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    const res = await fetch(
      `https://api.0x.org/gasless/quote?${searchParams}`,
      {
        headers: {
          "0x-api-key": process.env.ZEROX_API_KEY as string,
          "0x-version": "v2",
        },
      }
    );

    if (!res.ok) {
      console.error("0x Gasless API quote error:", res.status);
      return Response.json(
        { error: `0x Gasless API error: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error(
      "Gasless quote API error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return Response.json(
      { error: "Failed to fetch gasless quote" },
      { status: 500 }
    );
  }
}
