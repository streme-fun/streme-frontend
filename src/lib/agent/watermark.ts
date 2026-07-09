// On-chain watermark for gateway-built transactions.
//
// Every transaction the agent gateway builds carries an 18-byte watermark —
// in ERC777/GDA `userData` where the call has one (stake, connect-pool), or
// appended after the ABI-encoded calldata otherwise (buy, unstake, stream;
// verified inert against the target contracts). The Floor watcher reads it
// back off confirmed Base transactions to attribute activity.
//
// Byte layout (18 bytes total):
//   [0..3]   magic        0x5354524d ("STRM")
//   [4]      version      0x01
//   [5]      source       0x01 = agent, 0x02 = floor-ui
//   [6..13]  agentIdHash  first 8 bytes of keccak256(sanitized agentId);
//                         all zeros when no agentId was declared
//   [14..17] nonce        4 crypto-random bytes — identical-parameter builds
//                         stay byte-unique, so fingerprints never collide
//                         across agents

import { bytesToHex, keccak256, stringToHex, type Hex } from "viem";
import { AgentInputError } from "./txBuilders";

export const WATERMARK_MAGIC: Hex = "0x5354524d"; // ascii "STRM"
export const WATERMARK_VERSION = 0x01;
/** Watermark size in bytes (magic 4 + version 1 + source 1 + hash 8 + nonce 4). */
export const WATERMARK_LENGTH = 18;

export type WatermarkSource = "agent" | "floor-ui";

const SOURCE_BYTES: Record<WatermarkSource, number> = {
  agent: 0x01,
  "floor-ui": 0x02,
};

/**
 * agentId prefixes nobody can self-declare. `streme` keeps the whole
 * namespace (including the Resident's `streme-resident`) for the house.
 */
export const RESERVED_AGENT_ID_PREFIXES = ["streme", "streme-resident"];

const AGENT_ID_MAX_LENGTH = 32;
const AGENT_ID_RE = /^[a-z0-9\-_.]+$/;

/**
 * Normalize a self-declared agentId: lowercase, `[a-z0-9-_.]`, at most 32
 * chars, reserved prefixes rejected. Throws `AgentInputError` (the 400 path)
 * on any violation.
 */
export function sanitizeAgentId(raw: string): string {
  const id = raw.trim().toLowerCase();
  if (!id || id.length > AGENT_ID_MAX_LENGTH) {
    throw new AgentInputError(
      `agentId must be 1-${AGENT_ID_MAX_LENGTH} characters`
    );
  }
  if (!AGENT_ID_RE.test(id)) {
    throw new AgentInputError(
      "agentId may only contain lowercase letters, digits, '-', '_', and '.'"
    );
  }
  if (RESERVED_AGENT_ID_PREFIXES.some((prefix) => id.startsWith(prefix))) {
    throw new AgentInputError(
      `agentId prefixes ${RESERVED_AGENT_ID_PREFIXES.join(", ")} are reserved`
    );
  }
  return id;
}

const ZERO_AGENT_ID_HASH = "0".repeat(16);

/** First 8 bytes of keccak256 of the sanitized agentId, as bare hex chars. */
function agentIdHashHex(agentId?: string): string {
  if (!agentId) return ZERO_AGENT_ID_HASH;
  return keccak256(stringToHex(sanitizeAgentId(agentId))).slice(2, 18);
}

function randomNonceHex(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes).slice(2);
}

/** Encode the 18-byte watermark. Sanitizes `agentId` (throws on violation). */
export function encodeWatermark(params: {
  source?: WatermarkSource;
  agentId?: string;
  /**
   * Server-only identity escape hatch (the Resident's reserved
   * `streme-resident`): hashed as-is, skipping the reserved-prefix check.
   * Unreachable from the public surfaces — both the REST route and the MCP
   * zod schemas map explicit fields and never forward this one. Public
   * callers self-declaring a reserved id still get the AgentInputError.
   */
  internalAgentId?: string;
}): Hex {
  const source = SOURCE_BYTES[params.source ?? "agent"];
  const idHash = params.internalAgentId
    ? keccak256(stringToHex(params.internalAgentId)).slice(2, 18)
    : agentIdHashHex(params.agentId);
  return (WATERMARK_MAGIC +
    WATERMARK_VERSION.toString(16).padStart(2, "0") +
    source.toString(16).padStart(2, "0") +
    idHash +
    randomNonceHex()) as Hex;
}

export interface DecodedWatermark {
  version: number;
  source: WatermarkSource | "unknown";
  /** 8-byte hex; all zeros when no agentId was declared */
  agentIdHash: Hex;
  /** 4-byte hex */
  nonce: Hex;
}

/**
 * Decode a watermark that starts at the beginning of `hex`. Tolerant by
 * design: missing magic or short input → null, never a throw — the watcher
 * runs this over arbitrary chain data.
 */
export function decodeWatermark(hex: Hex): DecodedWatermark | null {
  const body = hex.toLowerCase().slice(2);
  if (body.length < WATERMARK_LENGTH * 2) return null;
  if (!body.startsWith(WATERMARK_MAGIC.slice(2))) return null;

  const sourceByte = parseInt(body.slice(10, 12), 16);
  const source = (Object.keys(SOURCE_BYTES) as WatermarkSource[]).find(
    (key) => SOURCE_BYTES[key] === sourceByte
  );

  return {
    version: parseInt(body.slice(8, 10), 16),
    source: source ?? "unknown",
    agentIdHash: `0x${body.slice(12, 28)}`,
    nonce: `0x${body.slice(28, 36)}`,
  };
}

/**
 * Locate a watermark anywhere inside a calldata blob by magic-byte scan and
 * decode from there. Handles wrapped calldata (4337 userOps, smart-wallet
 * batching) where the watermark is no longer a clean suffix.
 */
export function findWatermark(input: Hex): DecodedWatermark | null {
  const body = input.toLowerCase().slice(2);
  const magic = WATERMARK_MAGIC.slice(2);

  let at = body.indexOf(magic);
  while (at !== -1) {
    // Only byte-aligned (even nibble offset) matches are real candidates.
    if (at % 2 === 0) {
      const decoded = decodeWatermark(`0x${body.slice(at)}`);
      if (decoded) return decoded;
    }
    at = body.indexOf(magic, at + 1);
  }
  return null;
}

/**
 * Fingerprint of a built transaction: first 16 bytes of
 * keccak256(to.toLowerCase() + data). Shared by the builders (write side)
 * and the watcher (match side) — ≥128 bits, collision-safe.
 */
export function fingerprint(to: string, data: Hex): Hex {
  const hash = keccak256(
    `0x${to.toLowerCase().slice(2)}${data.toLowerCase().slice(2)}` as Hex
  );
  return hash.slice(0, 34) as Hex;
}
