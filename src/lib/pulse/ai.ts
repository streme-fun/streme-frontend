// Optional AI copywriting for bot casts.
//
// Template text is the source of truth; when enabled, Claude rewrites it in
// the @streme voice under hard constraints, and a validator guarantees every
// number and ticker from the template survives verbatim — any violation
// falls back to the template. The bot can get wittier as models improve,
// but it can never hallucinate a stat.
//
// Off by default: requires PULSE_AI_COPY=true and ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { CastDraft } from "./types";
import { trimToBytes } from "./casts";

const MAX_CAST_BYTES = 1024;

const SYSTEM_PROMPT = `You rewrite short Farcaster casts for @streme, the bot of streme.fun — a token launchpad on Base where every token streams staking rewards by the second.

Voice: sharp, playful, confident. Crypto-native but never cringe. No hype-spam.

Hard rules:
- Keep EVERY number, dollar amount, percentage, and $TICKER from the draft EXACTLY as written. Do not add, remove, round, or invent any figure.
- Keep every @mention exactly as written.
- Maximum 300 characters.
- No hashtags. No rocket-ship spam (one emoji max). No financial advice, no promises of returns.
- Keep the factual claims identical — you are restyling, not rewriting the facts.

Reply with ONLY the rewritten cast text, nothing else.`;

export function aiCopyEnabled(): boolean {
  return Boolean(
    process.env.PULSE_AI_COPY === "true" && process.env.ANTHROPIC_API_KEY
  );
}

/** Numbers, dollar figures, percents, tickers, and mentions that must survive. */
export function extractProtectedTokens(text: string): string[] {
  const matches = text.match(
    /\$[A-Za-z][A-Za-z0-9]*|\$[\d,.]+[kMB]?|[+-]?\d[\d,.]*%|@[a-z0-9_.-]+/g
  );
  return matches ?? [];
}

export function validateRewrite(original: string, rewritten: string): boolean {
  if (!rewritten || rewritten.trim().length === 0) return false;
  if (new TextEncoder().encode(rewritten).length > MAX_CAST_BYTES) return false;

  for (const token of extractProtectedTokens(original)) {
    if (!rewritten.includes(token)) return false;
  }
  return true;
}

/**
 * Rewrite a cast draft in the bot voice. Returns the draft unchanged when
 * disabled, on any API error, or when validation fails. Never throws.
 */
export async function polishCastDraft(draft: CastDraft): Promise<CastDraft> {
  if (!aiCopyEnabled()) return draft;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: process.env.PULSE_AI_MODEL || "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Rewrite this ${draft.kind.replace("_", " ")} cast:\n\n${draft.text}`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    const rewritten = block && block.type === "text" ? block.text.trim() : "";

    if (!validateRewrite(draft.text, rewritten)) {
      console.warn(
        "[Pulse AI] Rewrite failed validation, using template copy"
      );
      return draft;
    }

    return { ...draft, text: trimToBytes(rewritten, MAX_CAST_BYTES) };
  } catch (error) {
    console.warn("[Pulse AI] Copy generation failed, using template:", error);
    return draft;
  }
}
