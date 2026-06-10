// Streme MCP server — makes the whole platform usable by any MCP-capable
// agent (Claude, Cursor, agent frameworks) at https://streme.fun/api/mcp.
//
// Read tools return compact JSON; transaction tools return UNSIGNED
// transactions for the agent's own wallet to sign on Base. Streme never
// holds keys, so this surface needs no auth — it's market data plus
// calldata the caller could construct themselves.

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  AgentInputError,
  buildBuyTxForToken,
  buildConnectPoolTxForToken,
  buildStakeTxForToken,
  buildStreamTx,
  buildUnstakeTxForToken,
  capabilities,
  getPulse,
  getToken,
  getYield,
  listTokens,
} from "@/src/lib/agent/actions";

export const maxDuration = 60;

const ADDRESS = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "0x-prefixed EVM address");
const AMOUNT = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'decimal token amount string, e.g. "1000" or "0.5"');

function json(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function errorResult(error: unknown) {
  const message =
    error instanceof AgentInputError
      ? error.message
      : error instanceof Error
      ? `Streme API error: ${error.message}`
      : "Unknown error";
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "get_streme_capabilities",
      "Overview of Streme (token launchpad on Base where every token streams staking rewards by the second) and everything this server can do. Call this first.",
      {},
      async () => json(capabilities())
    );

    server.tool(
      "list_streme_tokens",
      "List or search trending Streme tokens with price, market cap, 24h volume, and staking info.",
      {
        query: z
          .string()
          .optional()
          .describe("Filter by name, symbol, or exact address"),
        limit: z.number().int().min(1).max(50).optional(),
      },
      async ({ query, limit }) => {
        try {
          return json({ tokens: await listTokens({ query, limit }) });
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "get_streme_token",
      "Get one Streme token by contract address, including staking contract and reward pool addresses.",
      { address: ADDRESS },
      async ({ address }) => {
        try {
          return json(await getToken(address));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "get_streme_pulse",
      "Live market pulse: top tokens ranked by the StremeScore (volume, momentum, freshness, stakers) with human-readable reasons, plus platform totals.",
      {},
      async () => {
        try {
          return json(await getPulse());
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "get_wallet_yield",
      "A wallet's live staking reward streams: tokens/day per stream, USD/day where known, and a shareable flex-card URL.",
      { address: ADDRESS },
      async ({ address }) => {
        try {
          return json(await getYield(address));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "build_buy_transaction",
      "Build an UNSIGNED transaction that buys a Streme token with ETH (optionally auto-staking the output so rewards stream immediately). Sign and send it with your own wallet on Base (chainId 8453).",
      {
        tokenAddress: ADDRESS,
        ethAmount: AMOUNT.describe('ETH to spend, e.g. "0.01"'),
        stake: z
          .boolean()
          .optional()
          .describe("Auto-stake the purchased tokens in the same transaction"),
        slippageBps: z.number().int().min(1).max(5000).optional(),
      },
      async (args) => {
        try {
          return json(await buildBuyTxForToken(args));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "build_stake_transaction",
      "Build an UNSIGNED transaction that stakes a Streme token (single ERC777 send to the StakingHelper — no approval step). Staked tokens earn a per-second reward stream.",
      { tokenAddress: ADDRESS, amount: AMOUNT },
      async (args) => {
        try {
          return json(await buildStakeTxForToken(args));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "build_unstake_transaction",
      "Build an UNSIGNED transaction that unstakes a Streme token back to a wallet (reverts during the ~24h deposit lock).",
      {
        tokenAddress: ADDRESS,
        to: ADDRESS.describe("Wallet to receive the unstaked tokens"),
        amount: AMOUNT,
      },
      async (args) => {
        try {
          return json(await buildUnstakeTxForToken(args));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "build_connect_pool_transaction",
      "Build an UNSIGNED transaction that connects a wallet to a token's reward pool (one-time per token; makes streamed rewards appear in the wallet balance).",
      { tokenAddress: ADDRESS },
      async (args) => {
        try {
          return json(await buildConnectPoolTxForToken(args));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.tool(
      "build_stream_transaction",
      "Build an UNSIGNED transaction that opens/updates a continuous per-second money stream of any Streme token to a receiver (Superfluid CFA). tokensPerDay='0' stops the stream.",
      {
        tokenAddress: ADDRESS,
        receiver: ADDRESS,
        tokensPerDay: z
          .string()
          .regex(/^\d+(\.\d+)?$/)
          .describe('Tokens per day, e.g. "100". "0" stops the stream.'),
      },
      async (args) => {
        try {
          return json(buildStreamTx(args));
        } catch (error) {
          return errorResult(error);
        }
      }
    );
  },
  {
    serverInfo: { name: "streme", version: "1.0.0" },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
