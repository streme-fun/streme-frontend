import { type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`https://api.0x.org/gasless/submit`, {
      method: "POST",
      headers: {
        "0x-api-key": process.env.ZEROX_API_KEY as string,
        "0x-version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("0x Gasless API submit error:", res.status, errorData);
      return Response.json(
        { error: `0x Gasless API error: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    console.log("gasless submit response", JSON.stringify(data, null, 2));

    return Response.json(data);
  } catch (error) {
    console.error("Gasless submit API error:", error);
    return Response.json(
      { error: "Failed to submit gasless transaction" },
      { status: 500 }
    );
  }
}
