// Unsigned transaction builders for agents: buy, stake, unstake,
// connect-pool, stream. POST JSON in, { description, tx, notes } out.
// The caller signs with their own wallet — Streme never holds keys.

import { NextRequest } from "next/server";
import {
  AgentInputError,
  buildBuyTxForToken,
  buildConnectPoolTxForToken,
  buildStakeTxForToken,
  buildStreamTxForToken,
  buildUnstakeTxForToken,
} from "@/src/lib/agent/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const str = (key: string): string =>
    typeof body[key] === "string" ? (body[key] as string) : "";
  // Optional self-declared attribution; sanitized inside the builders
  // (violations throw AgentInputError → 400 below).
  const agentId =
    typeof body.agentId === "string" ? (body.agentId as string) : undefined;
  // Optional watermark source (plan U6): only the Floor UI's copy-trade
  // marker is accepted — anything else keeps the default ("agent").
  const source = body.source === "floor-ui" ? ("floor-ui" as const) : undefined;

  try {
    let result;
    switch (action) {
      case "buy":
        result = await buildBuyTxForToken({
          tokenAddress: str("tokenAddress"),
          ethAmount: str("ethAmount"),
          stake: body.stake === true,
          slippageBps:
            typeof body.slippageBps === "number" ? body.slippageBps : undefined,
          agentId,
          source,
        });
        break;
      case "stake":
        result = await buildStakeTxForToken({
          tokenAddress: str("tokenAddress"),
          amount: str("amount"),
          agentId,
          source,
        });
        break;
      case "unstake":
        result = await buildUnstakeTxForToken({
          tokenAddress: str("tokenAddress"),
          to: str("to"),
          amount: str("amount"),
          agentId,
          source,
        });
        break;
      case "connect-pool":
        result = await buildConnectPoolTxForToken({
          tokenAddress: str("tokenAddress"),
          agentId,
          source,
        });
        break;
      case "stream":
        result = await buildStreamTxForToken({
          tokenAddress: str("tokenAddress"),
          receiver: str("receiver"),
          tokensPerDay: str("tokensPerDay"),
          agentId,
          source,
        });
        break;
      default:
        return Response.json(
          {
            error: `Unknown action "${action}". Valid: buy, stake, unstake, connect-pool, stream`,
          },
          { status: 404 }
        );
    }

    return Response.json(result, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    if (error instanceof AgentInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error(`[Agent API] tx/${action} error:`, error);
    return Response.json(
      { error: "Failed to build transaction" },
      { status: 500 }
    );
  }
}
