import { AgentInputError, getToken } from "@/src/lib/agent/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;
  try {
    const token = await getToken(address);
    return Response.json(token, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    if (error instanceof AgentInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[Agent API] token error:", error);
    return Response.json({ error: "Failed to load token" }, { status: 500 });
  }
}
