import { describe, expect, it } from "@jest/globals";
import { keccak256, stringToHex, type Hex } from "viem";
import { AgentInputError } from "@/src/lib/agent/txBuilders";
import {
  RESERVED_AGENT_ID_PREFIXES,
  WATERMARK_LENGTH,
  WATERMARK_MAGIC,
  decodeWatermark,
  encodeWatermark,
  findWatermark,
  fingerprint,
  sanitizeAgentId,
} from "@/src/lib/agent/watermark";

const AGENT_ID = "pulse-hunter";
// First 8 bytes of keccak256 of the sanitized agentId
const AGENT_ID_HASH = keccak256(stringToHex(AGENT_ID)).slice(0, 18) as Hex;

describe("encodeWatermark / decodeWatermark", () => {
  it("round-trips a watermark with an agentId hash", () => {
    const watermark = encodeWatermark({ source: "agent", agentId: AGENT_ID });

    // 18 bytes: magic 4 + version 1 + source 1 + hash 8 + nonce 4
    expect(watermark.length).toBe(2 + WATERMARK_LENGTH * 2);
    expect(watermark.startsWith(WATERMARK_MAGIC)).toBe(true);

    const decoded = decodeWatermark(watermark);
    expect(decoded).not.toBeNull();
    expect(decoded!.version).toBe(1);
    expect(decoded!.source).toBe("agent");
    expect(decoded!.agentIdHash).toBe(AGENT_ID_HASH);
    expect(decoded!.nonce).toMatch(/^0x[0-9a-f]{8}$/);
  });

  it("uses a zero agentId hash and the agent source by default", () => {
    const decoded = decodeWatermark(encodeWatermark({}));
    expect(decoded!.source).toBe("agent");
    expect(decoded!.agentIdHash).toBe("0x0000000000000000");
  });

  it("encodes the floor-ui source distinctly", () => {
    const decoded = decodeWatermark(encodeWatermark({ source: "floor-ui" }));
    expect(decoded!.source).toBe("floor-ui");
  });

  it("returns null on garbage and short input", () => {
    expect(decodeWatermark("0xdeadbeefdeadbeefdeadbeefdeadbeefdead")).toBeNull();
    expect(decodeWatermark("0x5354524d01")).toBeNull(); // magic but truncated
    expect(decodeWatermark("0x")).toBeNull();
  });
});

describe("findWatermark", () => {
  it("locates a watermark behind leading junk bytes (wrapped calldata)", () => {
    const watermark = encodeWatermark({ agentId: AGENT_ID });
    const wrapped = `0xdeadbeefcafe0123456789${watermark.slice(2)}` as Hex;

    const found = findWatermark(wrapped);
    expect(found).not.toBeNull();
    expect(found!.agentIdHash).toBe(AGENT_ID_HASH);
  });

  it("returns null when no watermark is present", () => {
    expect(findWatermark("0xdeadbeefdeadbeefdeadbeefdeadbeef")).toBeNull();
  });
});

describe("nonce uniqueness", () => {
  it("encodes different nonces and fingerprints for identical inputs", () => {
    const base =
      "0x9d42cb9b0000000000000000000000003b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as Hex;
    const to = "0x6C3D0E968d3C986886EEECA6Ba6Fecc949F17F6e";

    const a = encodeWatermark({ agentId: AGENT_ID });
    const b = encodeWatermark({ agentId: AGENT_ID });
    expect(a).not.toBe(b);
    expect(decodeWatermark(a)!.nonce).not.toBe(decodeWatermark(b)!.nonce);

    const fpA = fingerprint(to, (base + a.slice(2)) as Hex);
    const fpB = fingerprint(to, (base + b.slice(2)) as Hex);
    expect(fpA).not.toBe(fpB);
  });
});

describe("fingerprint", () => {
  it("is 16 bytes and case-insensitive on the to address", () => {
    const data = "0x1234" as Hex;
    const fp = fingerprint("0x6C3D0E968d3C986886EEECA6Ba6Fecc949F17F6e", data);
    expect(fp).toMatch(/^0x[0-9a-f]{32}$/);
    expect(fp).toBe(
      fingerprint("0x6c3d0e968d3c986886eeeca6ba6fecc949f17f6e", data)
    );
  });
});

describe("sanitizeAgentId", () => {
  it("accepts a well-formed id", () => {
    expect(sanitizeAgentId("pulse-hunter")).toBe("pulse-hunter");
  });

  it("rejects reserved prefixes (including via lowercasing)", () => {
    expect(RESERVED_AGENT_ID_PREFIXES).toContain("streme");
    expect(() => sanitizeAgentId("streme-resident")).toThrow(AgentInputError);
    expect(() => sanitizeAgentId("StremeFoo")).toThrow(AgentInputError);
  });

  it("rejects over-length and bad-charset ids", () => {
    expect(() => sanitizeAgentId("a".repeat(33))).toThrow(AgentInputError);
    expect(() => sanitizeAgentId("has space")).toThrow(AgentInputError);
    expect(() => sanitizeAgentId("emoji🤖")).toThrow(AgentInputError);
    expect(() => sanitizeAgentId("")).toThrow(AgentInputError);
  });
});
