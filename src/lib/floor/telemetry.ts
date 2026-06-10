// Gateway telemetry recording — fire-and-forget by contract.
//
// Every exported function resolves no matter what happens inside: a Redis
// hiccup (or any bug here) must NEVER reject a gateway call. Failures are
// swallowed after a single console.warn. Callers may invoke without
// awaiting (`void recordToolInvocation(...)`).

import { keccak256, stringToHex, type Hex } from "viem";
import {
  findWatermark,
  fingerprint,
  sanitizeAgentId,
} from "@/src/lib/agent/watermark";
import {
  putFingerprint,
  putNonceIndex,
  recordToolCall,
} from "./store";

/**
 * Short (8-byte) digest of the call params. Telemetry stores aggregates
 * only — never raw params: built-but-unsigned tx detail (token, size) is
 * front-running surface (plan R5).
 */
function paramsDigest(params: unknown): string {
  return keccak256(stringToHex(JSON.stringify(params ?? null))).slice(0, 18);
}

/**
 * Sanitize defensively: telemetry must not throw, so an invalid agentId
 * records as null here even though the API edge already rejects it.
 */
function safeAgentId(agentId?: string): string | null {
  if (!agentId) return null;
  try {
    return sanitizeAgentId(agentId);
  } catch {
    return null;
  }
}

/** Record one gateway tool invocation (read or build). Never rejects. */
export async function recordToolInvocation(input: {
  tool: string;
  params: unknown;
  agentId?: string;
}): Promise<void> {
  try {
    await recordToolCall({
      tool: input.tool,
      paramsDigest: paramsDigest(input.params),
      agentId: safeAgentId(input.agentId),
      at: Date.now(),
    });
  } catch (error) {
    console.warn("[floor/telemetry] tool-call record failed (ignored):", error);
  }
}

/**
 * Record a built transaction: fingerprint record keyed by
 * `fingerprint(to, data)` plus the watermark-nonce index the watcher joins
 * against. Never rejects.
 */
export async function recordBuild(input: {
  tool: string;
  agentId?: string;
  to: string;
  data: Hex;
}): Promise<void> {
  try {
    const fp = fingerprint(input.to, input.data);
    const nonce = findWatermark(input.data)?.nonce ?? null;
    await putFingerprint(fp, {
      tool: input.tool,
      agentId: safeAgentId(input.agentId),
      builtAt: Date.now(),
      nonce,
    });
    if (nonce) await putNonceIndex(nonce, fp);
  } catch (error) {
    console.warn("[floor/telemetry] build record failed (ignored):", error);
  }
}
