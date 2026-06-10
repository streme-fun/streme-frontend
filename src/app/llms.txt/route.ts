// /llms.txt — machine-readable platform docs, the convention agents and
// LLM crawlers check first. Everything here is public information.

export const dynamic = "force-dynamic";

export async function GET() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://streme.fun";

  const text = `# Streme

> Streme is a token launchpad on Base (chainId 8453) where every token is a native Superfluid Super Token that streams staking rewards by the second. Stake any Streme token and rewards flow into your wallet continuously — no claiming, no epochs. Trading fees feed the flywheel: a share streams back to stakers and buys back $STREME.

Streme is agent-native: anything a user can do in the UI, an agent can do through the gateway below. Streme never holds keys — transaction endpoints return UNSIGNED transactions for the agent's own wallet to sign on Base.

## Agent Gateway

- MCP server (recommended): ${base}/api/mcp — streamable HTTP transport. Add this URL to any MCP-capable agent (Claude, Cursor, agent frameworks). Tools: get_streme_capabilities, list_streme_tokens, get_streme_token, get_streme_pulse, get_wallet_yield, build_buy_transaction, build_stake_transaction, build_unstake_transaction, build_connect_pool_transaction, build_stream_transaction.
- REST: ${base}/api/agent — self-describing capabilities document with all endpoints.

## Core flows for agents

1. Discover: GET ${base}/api/agent/tokens?q=<search> or the get_streme_pulse tool for ranked trending tokens with reasons.
2. Buy (+ auto-stake): POST ${base}/api/agent/tx/buy {"tokenAddress","ethAmount","stake":true} → unsigned zap transaction. Sign with your wallet; the output is staked and rewards stream to you immediately.
3. Stake existing tokens: POST ${base}/api/agent/tx/stake {"tokenAddress","amount"} → a single ERC777 send() to the StakingHelper. No approval transaction needed.
4. Connect the reward pool (once per token): POST ${base}/api/agent/tx/connect-pool {"tokenAddress"} — makes streamed rewards visible in the wallet balance.
5. Stream money: POST ${base}/api/agent/tx/stream {"tokenAddress","receiver","tokensPerDay"} — open a continuous per-second stream to any address (Superfluid CFA). "0" stops it.
6. Show off: GET ${base}/api/agent/yield/<address> returns live reward streams and a shareable flex-card URL (${base}/yield/<address>).

## Transaction contract

All tx endpoints return: { "description", "tx": { "to", "data", "value"?, "chainId": 8453 }, "notes": [] }. Always sign on Base (chainId 8453). Amounts are decimal strings in whole tokens (18 decimals handled server-side).

## Key facts

- Token supply: 100B per token. Default: 20% streams to stakers over 365 days (V2 tokens configurable, plus team vaults with lockup + vesting).
- Staking: stake → stTOKEN 1:1; rewards proportional to your share of staked supply; ~24h deposit lock, reset on each stake.
- Trading fees (1% Uniswap V3 tier): 40% to the token's creator, 60% to the protocol flywheel (staker boosts + $STREME buybacks).
- Launching: via the Streme UI (${base}/launch) or by casting "@streme" on Farcaster with a name + ticker.
- Live market data: GET ${base}/api/pulse (rankings, milestones, automated bot activity).

## Pages

- ${base}/ — token discovery and trading
- ${base}/pulse — live rankings, milestones, bot activity
- ${base}/launch — launch a token
- ${base}/yield/<address> — a wallet's live streaming yield (shareable)
- ${base}/agents — human-readable guide to this gateway

## Source docs

- Farcaster mini-app docs: https://miniapps.farcaster.xyz/llms-full.txt
- Superfluid protocol: https://docs.superfluid.org
`;

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
