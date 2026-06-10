import { describe, expect, it } from "@jest/globals";
import {
  decodeFunctionData,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseEther,
  stringToHex,
  type Hex,
} from "viem";
import {
  AgentInputError,
  BASE_CHAIN_ID,
  STAKING_HELPER,
  buildBuyTx,
  buildConnectPoolTx,
  buildStakeTx,
  buildStreamTx,
  buildUnstakeTx,
} from "@/src/lib/agent/txBuilders";
import {
  WATERMARK_LENGTH,
  decodeWatermark,
} from "@/src/lib/agent/watermark";

const TOKEN = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
const STAKING = "0x93419f1c0f73b278c73085c17407794a6580deff";
const POOL = "0xa040a8564c433970d7919c441104b1d25b9eaa1c";
const WALLET = "0x09a900eb2ff6e9aca12d4d1a396ddc9be0307661";

const WATERMARK_HEX_CHARS = WATERMARK_LENGTH * 2;
const ZERO_AGENT_ID_HASH = "0x0000000000000000";

/** Split suffix-watermarked calldata into the ABI-encoded core + watermark. */
function splitWatermark(data: Hex): { core: Hex; watermark: Hex } {
  return {
    core: data.slice(0, -WATERMARK_HEX_CHARS) as Hex,
    watermark: `0x${data.slice(-WATERMARK_HEX_CHARS)}` as Hex,
  };
}

describe("buildStakeTx", () => {
  it("encodes an ERC777 send to the StakingHelper", () => {
    const built = buildStakeTx({ tokenAddress: TOKEN, amount: "1000" });

    expect(built.tx.to).toBe(TOKEN);
    expect(built.tx.chainId).toBe(BASE_CHAIN_ID);
    expect(built.tx.value).toBeUndefined();

    const decoded = decodeFunctionData({
      abi: parseAbi([
        "function send(address recipient, uint256 amount, bytes userData)",
      ]),
      data: built.tx.data,
    });
    expect(decoded.functionName).toBe("send");
    expect((decoded.args[0] as string).toLowerCase()).toBe(
      STAKING_HELPER.toLowerCase()
    );
    expect(decoded.args[1]).toBe(parseEther("1000"));

    // userData carries a valid watermark (no agentId → zero hash)
    const watermark = decodeWatermark(decoded.args[2] as Hex);
    expect(watermark).not.toBeNull();
    expect(watermark!.source).toBe("agent");
    expect(watermark!.agentIdHash).toBe(ZERO_AGENT_ID_HASH);
  });

  it("embeds the agentId hash in the userData watermark", () => {
    const built = buildStakeTx({
      tokenAddress: TOKEN,
      amount: "1000",
      agentId: "pulse-hunter",
    });
    const decoded = decodeFunctionData({
      abi: parseAbi([
        "function send(address recipient, uint256 amount, bytes userData)",
      ]),
      data: built.tx.data,
    });
    const watermark = decodeWatermark(decoded.args[2] as Hex);
    expect(watermark!.agentIdHash).toBe(
      keccak256(stringToHex("pulse-hunter")).slice(0, 18)
    );
  });

  it("rejects bad addresses and amounts", () => {
    expect(() =>
      buildStakeTx({ tokenAddress: "not-an-address", amount: "1" })
    ).toThrow(AgentInputError);
    expect(() =>
      buildStakeTx({ tokenAddress: TOKEN, amount: "0" })
    ).toThrow(AgentInputError);
    expect(() =>
      buildStakeTx({ tokenAddress: TOKEN, amount: "lots" })
    ).toThrow(AgentInputError);
  });
});

describe("buildUnstakeTx", () => {
  it("encodes unstake(to, amount) on the staking contract", () => {
    const built = buildUnstakeTx({
      stakingAddress: STAKING,
      to: WALLET,
      amount: "50.5",
    });

    expect(built.tx.to).toBe(STAKING);
    const { core, watermark } = splitWatermark(built.tx.data);
    const decoded = decodeFunctionData({
      abi: parseAbi(["function unstake(address to, uint256 amount)"]),
      data: core,
    });
    expect((decoded.args[0] as string).toLowerCase()).toBe(WALLET);
    expect(decoded.args[1]).toBe(parseEther("50.5"));
    expect(decodeWatermark(watermark)).not.toBeNull();
  });
});

describe("buildConnectPoolTx", () => {
  it("targets the GDA forwarder with the pool address", () => {
    const built = buildConnectPoolTx({ poolAddress: POOL });
    expect(built.tx.to).toBe("0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08");

    const decoded = decodeFunctionData({
      abi: parseAbi([
        "function connectPool(address pool, bytes userData) returns (bool)",
      ]),
      data: built.tx.data,
    });
    expect((decoded.args[0] as string).toLowerCase()).toBe(POOL);
    // userData carries the watermark (surfaces in PoolConnectionUpdated)
    expect(decodeWatermark(decoded.args[1] as Hex)).not.toBeNull();
  });
});

describe("buildStreamTx", () => {
  const STREAM_ABI = parseAbi([
    "function setFlowrate(address token, address receiver, int96 flowrate) returns (bool)",
  ]);

  it("converts tokens/day to wei/second", () => {
    const built = buildStreamTx({
      tokenAddress: TOKEN,
      receiver: WALLET,
      tokensPerDay: "86400",
    });

    const { core, watermark } = splitWatermark(built.tx.data);
    const decoded = decodeFunctionData({
      abi: STREAM_ABI,
      data: core,
    });
    // 86400 tokens/day = 1 token/second = 1e18 wei/second
    expect(decoded.args[2]).toBe(10n ** 18n);
    expect(decodeWatermark(watermark)).not.toBeNull();
  });

  it("stops the stream at zero", () => {
    const built = buildStreamTx({
      tokenAddress: TOKEN,
      receiver: WALLET,
      tokensPerDay: "0",
    });
    const decoded = decodeFunctionData({
      abi: STREAM_ABI,
      data: splitWatermark(built.tx.data).core,
    });
    expect(decoded.args[2]).toBe(0n);
    expect(built.description).toContain("Stop");
  });
});

describe("buildBuyTx", () => {
  const ZAP_ABI = parseAbi([
    "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) payable returns (uint256)",
  ]);

  it("encodes a zap with slippage from the injected quote", async () => {
    const built = await buildBuyTx({
      tokenAddress: TOKEN,
      ethAmount: "0.01",
      quotedAmountOut: 1_000_000n * 10n ** 18n,
      slippageBps: 100, // 1%
    });

    expect(built.tx.value).toBe(`0x${parseEther("0.01").toString(16)}`);
    expect(built.tx.chainId).toBe(BASE_CHAIN_ID);

    const { core, watermark } = splitWatermark(built.tx.data);
    // The calldata is the exact ABI encoding plus the watermark suffix —
    // trailing bytes the zap contract never inspects.
    expect(core).toBe(
      encodeFunctionData({
        abi: ZAP_ABI,
        functionName: "zap",
        args: [
          TOKEN,
          parseEther("0.01"),
          990_000n * 10n ** 18n, // 1% slippage off 1M tokens
          "0x0000000000000000000000000000000000000000", // no stake
        ],
      })
    );
    expect(decodeWatermark(watermark)).not.toBeNull();

    const decoded = decodeFunctionData({ abi: ZAP_ABI, data: core });
    expect((decoded.args[0] as string).toLowerCase()).toBe(TOKEN);
    expect(decoded.args[1]).toBe(parseEther("0.01"));
    expect(decoded.args[2]).toBe(990_000n * 10n ** 18n);
    expect(decoded.args[3]).toBe("0x0000000000000000000000000000000000000000");
  });

  it("passes the staking contract when stake=true", async () => {
    const built = await buildBuyTx({
      tokenAddress: TOKEN,
      ethAmount: "0.01",
      stake: true,
      stakingAddress: STAKING,
      quotedAmountOut: 10n ** 18n,
    });
    const decoded = decodeFunctionData({
      abi: ZAP_ABI,
      data: splitWatermark(built.tx.data).core,
    });
    expect((decoded.args[3] as string).toLowerCase()).toBe(STAKING);
  });

  it("round-trips the agentId hash through the calldata suffix", async () => {
    const built = await buildBuyTx({
      tokenAddress: TOKEN,
      ethAmount: "0.01",
      quotedAmountOut: 10n ** 18n,
      agentId: "pulse-hunter",
    });
    const watermark = decodeWatermark(splitWatermark(built.tx.data).watermark);
    expect(watermark!.agentIdHash).toBe(
      keccak256(stringToHex("pulse-hunter")).slice(0, 18)
    );
  });

  it("requires a staking address when stake=true", async () => {
    await expect(
      buildBuyTx({
        tokenAddress: TOKEN,
        ethAmount: "0.01",
        stake: true,
        quotedAmountOut: 10n ** 18n,
      })
    ).rejects.toThrow(AgentInputError);
  });

  it("rejects out-of-range slippage", async () => {
    await expect(
      buildBuyTx({
        tokenAddress: TOKEN,
        ethAmount: "0.01",
        slippageBps: 10_000,
        quotedAmountOut: 10n ** 18n,
      })
    ).rejects.toThrow(AgentInputError);
  });
});
