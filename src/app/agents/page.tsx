import type { Metadata } from "next";
import Link from "next/link";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";

export const metadata: Metadata = {
  title: "Bring Your Agent - Streme",
  description:
    "Streme is agent-native: connect any AI agent via MCP or REST to discover tokens, buy, stake, stream money, and flex yield — with the agent's own wallet.",
  openGraph: {
    title: "Bring Your Agent to Streme",
    description:
      "Connect any AI agent via MCP to trade, stake, and stream tokens on Base.",
    type: "website",
    siteName: "Streme",
    url: `${baseUrl}/agents`,
  },
};

const EXAMPLES = [
  {
    prompt: "What's trending on Streme right now?",
    detail:
      "Your agent calls get_streme_pulse and reads ranked tokens with human-readable reasons — volume, momentum, staker growth.",
  },
  {
    prompt: "Buy 0.01 ETH of $STREME and stake it",
    detail:
      "One unsigned zap transaction: buy + auto-stake in a single signature. Rewards start streaming to the wallet that second.",
  },
  {
    prompt: "Stream 100 $STREME per day to @alice's wallet",
    detail:
      "Your agent opens a Superfluid stream — continuous, per-second payments that run until stopped.",
  },
  {
    prompt: "How much yield is my wallet earning?",
    detail:
      "get_wallet_yield returns every live reward stream in tokens/day and USD/day, plus a shareable flex card.",
  },
];

const MCP_CONFIG = `{
  "mcpServers": {
    "streme": {
      "url": "${baseUrl}/api/mcp"
    }
  }
}`;

const CURL_EXAMPLE = `# Discover
curl ${baseUrl}/api/agent/tokens?q=streme

# Build a buy + auto-stake transaction (unsigned — you sign it)
curl -X POST ${baseUrl}/api/agent/tx/buy \\
  -H "Content-Type: application/json" \\
  -d '{"tokenAddress":"0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58","ethAmount":"0.01","stake":true}'`;

export default function AgentsPage() {
  return (
    <div className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">Bring Your Agent</h1>
        <p className="text-lg opacity-80 max-w-2xl">
          Streme is agent-native. Anything you can do here, your AI agent can
          do for you — discover tokens, buy, stake, stream money by the
          second, and flex your yield. Your agent signs with{" "}
          <span className="font-semibold">its own wallet</span>; Streme never
          holds keys.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {EXAMPLES.map((example) => (
          <div key={example.prompt} className="card bg-base-100 shadow-sm">
            <div className="card-body p-5">
              <p className="font-mono text-sm text-primary">
                &ldquo;{example.prompt}&rdquo;
              </p>
              <p className="text-sm opacity-70">{example.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-10">
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            1. Connect via MCP (recommended)
          </h2>
          <p className="opacity-80 mb-4">
            Add the Streme MCP server to Claude, Cursor, or any MCP-capable
            agent and it gets ten tools: market data, the live pulse, wallet
            yield, and unsigned transaction builders for buy / stake / unstake
            / stream.
          </p>
          <div className="mockup-code text-sm">
            <pre>
              <code>{MCP_CONFIG}</code>
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">2. Or plain REST</h2>
          <p className="opacity-80 mb-4">
            Every capability is also a documented REST endpoint. Start at{" "}
            <Link href="/api/agent" className="link link-primary font-mono">
              /api/agent
            </Link>{" "}
            (self-describing) or{" "}
            <Link href="/llms.txt" className="link link-primary font-mono">
              /llms.txt
            </Link>{" "}
            (docs your agent can read).
          </p>
          <div className="mockup-code text-sm">
            <pre>
              <code>{CURL_EXAMPLE}</code>
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">How signing works</h2>
          <p className="opacity-80">
            Transaction tools return{" "}
            <span className="font-mono text-sm">
              {"{ description, tx: { to, data, value?, chainId: 8453 }, notes }"}
            </span>
            . Your agent reviews the description, signs with its own wallet,
            and broadcasts on Base. Unsigned calldata means there is nothing
            to trust but the math — the same transactions our UI buttons
            build.
          </p>
        </section>

        <section className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title">Why this exists</h2>
            <p className="opacity-80">
              Streme tokens stream staking rewards every second — a primitive
              built for software, not just humans. As agents get better, they
              need venues where value can flow continuously and
              programmatically.{" "}
              <Link href="/pulse" className="link link-primary">
                Watch the streams live →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
