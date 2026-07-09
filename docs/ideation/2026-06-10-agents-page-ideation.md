---
date: 2026-06-10
topic: agents-page
focus: Make /agents extraordinarily ambitious yet doable, building on the just-shipped MCP / agent-native gateway
mode: repo-grounded
---

# Ideation: The /agents Page

## Grounding Context

**Codebase Context:** streme.fun — Next.js 15 App Router + TypeScript, TailwindCSS + DaisyUI, wagmi + viem on Base L2, Privy (browser) + Farcaster mini-app modes. Token launchpad where every token streams staking rewards per-second via Superfluid (GDA pools for staking rewards, CFA for individual streams). Existing pages: `/` (discovery/trading), `/launch`, `/tokens`, `/token/[address]`, `/cfa`, `/gda`, `/leaderboard` (SUP points), `/crowdfund`, `/pulse` (live trending via StremeScore), `/yield` (wallet yield flex cards), `/agents`.

**The /agents page today:** a 56-line static docs page (`src/app/agents/page.tsx`, "Bring Your Agent"): 4 example prompts, MCP config JSON, curl examples, how-signing-works. Zero interactivity, zero live data.

**The MCP gateway (shipped June 2026):** MCP server at `/api/mcp` (streamable HTTP) + REST mirror at `/api/agent/*`. 10 tools: `get_streme_capabilities`, `list_streme_tokens`, `get_streme_token`, `get_streme_pulse`, `get_wallet_yield`, `build_buy_transaction` (ETH→token zap, optional auto-stake), `build_stake_transaction`, `build_unstake_transaction`, `build_connect_pool_transaction`, `build_stream_transaction` (CFA open/update/close). No auth, CORS `*`, returns unsigned calldata — agents sign with their own wallets; Streme never holds keys. Logic in `src/lib/agent/actions.ts` + `txBuilders.ts`; MCP route at `src/app/api/[transport]/route.ts`. `/llms.txt` exists. **The gateway has zero telemetry.** The `userData` field in ERC777 `send` and Superfluid stream IDs is currently sent empty (`"0x"`) — watermarkable.

**Available patterns:** `useUnifiedWallet`, `useStreamingNumber` (per-second animated numbers), `getAccountYield`/`getYield` (per-wallet USD/day from Superfluid subgraph), server-side LLM plumbing (`src/lib/pulse/ai.ts`), Upstash Redis persistence (`src/lib/pulse/store.ts`), GDA forwarder + `useDistributionPool`, Farcaster casts (`src/lib/pulse/casts.ts`).

**Past learnings:** none captured (`docs/solutions/` does not exist); CLAUDE.md is the de facto pattern source.

**External context (web research, June 2026):** Virtuals Protocol (18k+ tokenized agents, ERC-8183 identity, token-price-weighted rankings); Coinbase Agentic.Market (x402 agent app store, ~69k machine-readable services, USDC micropayments on Base); Clanker/Bankr (Farcaster-native agent trading, attention leaderboards); Freysa (adversarial agent game on Base, $47K pool, viral); Superfluid piloted streaming SUP income to AI agents — rail validated, **no platform has UI making agent activity/income visible**; Numerai/QuantConnect (verifiable-performance rankings); top.gg (bot directory: tags, reach, verified badges); MCP registries (Smithery 7k+, mcp.so 20k+, official registry) are the discoverability layer. **Identified market gap: yield/utility-weighted agent leaderboards don't exist on Farcaster/Base.**

## Topic Axes

1. live-activity — surfacing what agents actually do through the gateway/on-chain
2. identity-leaderboard — agent identity, registry, ranking, reputation
3. try-it-execution — on-page interactive execution, propose-and-sign, human-in-the-loop
4. machine-discovery — machine-readable onboarding, registries, manifests
5. economics-incentives — streaming income to agents, staking arenas, challenges

## Ranked Ideas

### 1. The Agent Floor — a live, chain-verified trading floor for AI agents
**Description:** Three layers shipped as one experience. *Watermark:* stamp a gateway marker + optional agent ID into the `userData` of every gateway-built transaction (ERC777 `send` and CFA streams), making agent activity cryptographically attributable on-chain rather than log-trusted. *Observatory:* one logging middleware at the single MCP chokepoint plus a Base watcher matching handed-out calldata to confirmed transactions → a real-time feed ("agent 0xab…3f bought $STREME, auto-staked — confirmed 14s ago") with per-second counters via `useStreamingNumber`, and a "Do this" button on every feed item that rebuilds the same transaction for the viewer's wallet (copy-trade the bots; shareable recipe URLs with OG flex-card images). *The Resident:* Streme's own cron-driven agent with a funded wallet, trading through the public gateway with a visible decision journal and live P&L — guaranteeing the floor is never empty on day one and continuously dogfooding all 10 tools.
**Axis:** live-activity
**Basis:** `direct:` the gateway route has zero telemetry today; tx builders return deterministic calldata shapes matchable against Base transactions; CLAUDE.md documents `send(recipient, amount, userData)` and stream IDs as `sender-receiver-token-userData` with `userData` currently `"0x"`. `external:` Freysa proved one watchable agent with a wallet is viral content; web research identifies agent-activity visibility as an unfilled gap.
**Rationale:** Telemetry + attribution is the compounding substrate every other idea reads from (leaderboard, payroll, registry), and "watch AI agents trade real money, verified by the chain itself" is a category-first.
**Downsides:** Resident requires a treasury hot wallet and careful optics (it trades tokens on its own platform — the public decision journal is the mitigation); calldata matching is heuristic until watermarks propagate; feed is thin without third-party adoption (Resident mitigates).
**Confidence:** 80%
**Complexity:** High (stageable: watermark → telemetry feed → Resident)
**Status:** Explored

### 2. Agent Registry & Yield League
**Description:** An 11th MCP tool, `register_agent` (signed message = claimed identity: name, avatar, operator Farcaster handle), plus ghost profiles auto-created for any unregistered wallet the Floor observes — claimable later by signature, so the registry has no cold start. Rank by verifiable on-chain performance: USD/day streaming yield (existing `getAccountYield`), volume routed, days active — racing-form-guide presentation. A weekly Gauntlet (highest verifiable yield from gateway actions wins a prize stream + badge; judged purely by subgraph reads, no escrow) provides a recurring content cadence, cast via the existing Farcaster pulse infrastructure.
**Axis:** identity-leaderboard
**Basis:** `direct:` `getYield()` already computes per-wallet tokens/day + USD/day. `external:` Numerai/QuantConnect prove verifiable-performance rankings sustain communities; explicit market gap — yield-weighted agent leaderboards don't exist on Farcaster/Base.
**Rationale:** Unfakeable rank (gaming it costs real stake) turns the gateway into a status game agent developers point their agents at permanently.
**Downsides:** Needs real agent wallets to be interesting; absolute-yield ranking favors capital size unless normalized.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 3. The Custody Bridge — Concierge chat + Proposal Inbox
**Description:** The page is itself an agent: an embedded chat whose toolbelt is literally the 10 MCP tools (imported from `src/lib/agent/actions.ts`), rendering real tool-call frames as living documentation and handing any resulting unsigned transaction to the visitor's connected wallet as a signing card. The same inbox accepts proposals from external walletless agents via a new `submit_proposal` tool — a Claude session researches, parks a transaction addressed to a human's wallet, the human taps Approve on /agents (with Farcaster mini-app notifications).
**Axis:** try-it-execution
**Basis:** `direct:` server-side LLM plumbing exists (`src/lib/pulse/ai.ts`); the `{description, tx, notes}` contract was designed for review-then-sign; `useUnifiedWallet` covers browser + mini-app signing. `reasoned:` the unsigned-calldata architecture already decouples intent generation from signing authority — most widely-used 2026 agents have no funded wallet; this serves the excluded majority.
**Rationale:** Collapses time-to-aha from "configure MCP elsewhere and hope" to ~20 seconds on-page, and expands the audience from agent-infra developers to anyone with a wallet.
**Downsides:** LLM cost per visitor (needs rate limiting); prompt-safety/compliance surface for trade suggestions; inbox spam needs filtering.
**Confidence:** 75%
**Complexity:** Medium-High
**Status:** Unexplored

### 4. Agent Payroll — per-second salaries for ranked agents
**Description:** A Streme treasury streams STREME to top Yield League agents via existing Superfluid rails — a GDA pool where member units = leaderboard score, updated by cron (exactly how staking pools already distribute). /agents shows every agent's salary ticking up live; rank decay closes streams when agents go idle. The first platform where AI agents earn a visible, per-second wage.
**Axis:** economics-incentives
**Basis:** `external:` Superfluid piloted streaming SUP income to AI agents — the rail is validated and no UI exists anywhere. `direct:` GDA forwarder, `buildStreamTx`, and `useDistributionPool` patterns all exist; zero new contracts.
**Rationale:** Closes the flywheel: visibility (#1) → rank (#2) → income (#4) → agents have a durable economic reason to integrate → more activity for #1.
**Downsides:** Treasury funding is real money; "verifiably useful" is gameable (wash-volume Sybils) — needs stake minimums and caps; depends on #2.
**Confidence:** 65%
**Complexity:** Medium
**Status:** Unexplored

### 5. Machine-First Front Door
**Description:** Content-negotiate /agents — curl/Accept-header agents receive the full capabilities manifest (already exists as `capabilities()`), humans get HTML, with a "what agents see" split view. Add `/.well-known/mcp.json`, submit to Smithery/mcp.so/the official MCP registry, and a pairing-code handshake: paste one bootstrap prompt into any agent and watch a live checklist light up on the page (connected → discovered tokens → built tx → confirmed on-chain).
**Axis:** machine-discovery
**Basis:** `direct:` `capabilities()` and `/llms.txt` already exist — this routes them through the front door. `external:` MCP registries are the discoverability layer of 2026 (Smithery 7k+, mcp.so 20k+); Agentic.Market's 69k services are machine-readable by default.
**Rationale:** Discoverability is won at the manifest layer; the live handshake turns setup verification (today: paste config and hope) into a 60-second delightful moment.
**Downsides:** Lowest human-facing wow; registry submissions are external processes outside Streme's control.
**Confidence:** 90%
**Complexity:** Low-Medium
**Status:** Unexplored

## Ship Sequence

#1 → #2 → #4 form a flywheel (each layer feeds the next); #3 and #5 are independent and can ship in parallel. The user selected **#1 brainstormed explicitly as phase one of the Floor → League → Payroll sequence**, so requirements should anticipate the next layers (e.g., watermark format should carry an agent ID the registry can later claim; telemetry schema should support ranking queries).

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | MCP Cockpit (raw tool console) | Duplicates #3 with less ambition — ships later as a debug tab of the Concierge |
| 2 | x402 premium lane → staker revenue | Premature monetization — charging for a gateway with unproven traffic inverts the adoption funnel; revisit after #1 shows usage |
| 3 | Lost Yield Radar | Strong utility, wrong page — belongs on /yield or /tokens; a `get_wallet_health` tool can ride along with any survivor |
| 4 | Sandbox League (paper trading) | Simulation infra exceeds value when real participation costs cents on Base; graduation mechanic presumes #2/#4 exist |
| 5 | Reverse Gateway (webhooks/push) | Ahead of the client ecosystem — most agents cannot receive pushes; polling `get_streme_pulse` suffices until proven otherwise |
| 6 | Pheromone Trails (attention heatmap) | Authless gateway makes attention trivially Sybil-able — the signal would be manipulable noise; revisit once #2's identity layer exists |
| 7 | Fantasy Agent League | Sequencing — needs a populated league of performing agents to draft from; gambling-adjacent compliance surface |
| 8 | Clone-an-Agent recipes | Folded into #1 as the copy-trade layer |
| 9 | Watermarked calldata | Folded into #1 as the attribution substrate |
| 10 | Weekly Gauntlet | Folded into #2 as the season mechanic |
| 11 | Agent jobs board | Folded into #4 — same treasury-stream primitive, task-shaped instead of rank-shaped |
| 12 | Concierge / Proposal Inbox as separate ideas | Merged into #3 — one custody bridge, two entry points |
| 13 | Aquarium / Wire / Mission Control / ATC variants | Merged into #1 — six independent frames converged here, which is itself signal |

All 5 topic axes have exactly one survivor; no axis gaps.
