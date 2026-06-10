// Public yield data for a wallet — powers /yield/[address] and its OG card.

import { getAccountYield } from "@/src/lib/yield";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;

  if (!ADDRESS_RE.test(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const accountYield = await getAccountYield(address);
    return Response.json(accountYield, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[Yield API] Error:", error);
    return Response.json(
      { error: "Failed to load yield data" },
      { status: 500 }
    );
  }
}
