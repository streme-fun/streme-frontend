import { NextRequest } from "next/server";
import { LaunchedToken } from "@/src/app/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deployer: string }> }
) {
  try {
    const { deployer } = await params;

    if (!deployer) {
      return Response.json(
        { error: "Deployer address is required" },
        { status: 400 }
      );
    }

    const headers = {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    };

    const response = await fetch(
      `https://api.streme.fun/api/tokens/deployer/${deployer}?type=all`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch launched tokens: ${response.statusText}`
      );
    }

    const tokens: LaunchedToken[] = await response.json();

    return Response.json(
      {
        data: tokens,
        total: tokens.length,
      },
      { headers }
    );
  } catch (error) {
    console.error("Error fetching launched tokens:", error);
    return Response.json(
      {
        error: "Failed to fetch launched tokens",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
