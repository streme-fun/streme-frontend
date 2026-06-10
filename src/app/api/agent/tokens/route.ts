import { NextRequest } from "next/server";
import { listTokens } from "@/src/lib/agent/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? undefined;
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const tokens = await listTokens({ query, limit });
    return Response.json(
      { tokens },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[Agent API] tokens error:", error);
    return Response.json({ error: "Failed to list tokens" }, { status: 500 });
  }
}
