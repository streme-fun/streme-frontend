// Agent gateway discovery document — what Streme can do for your agent.

import { capabilities } from "@/src/lib/agent/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(capabilities(), {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
