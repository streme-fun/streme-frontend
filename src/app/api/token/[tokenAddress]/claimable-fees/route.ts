import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tokenAddress: string }> }
) {
  const { tokenAddress } = await context.params;
  if (!tokenAddress) {
    return NextResponse.json(
      { error: "Missing token address" },
      { status: 400 }
    );
  }

  try {
    const apiUrl = `https://api.streme.fun/token/fees/${tokenAddress}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch claimable fees" },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
