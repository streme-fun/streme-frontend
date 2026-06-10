import { describe, expect, it } from "@jest/globals";
import { decodeFunctionData, parseAbi, parseEther } from "viem";
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

const TOKEN = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
const STAKING = "0x93419f1c0f73b278c73085c17407794a6580deff";
const POOL = "0xa040a8564c433970d7919c441104b1d25b9eaa1c";
const WALLET = "0x09a900eb2ff6e9aca12d4d1a396ddc9be0307661";

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
    expect(decoded.args[2]).toBe("0x");
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
    const decoded = decodeFunctionData({
      abi: parseAbi(["function unstake(address to, uint256 amount)"]),
      data: built.tx.data,
    });
    expect((decoded.args[0] as string).toLowerCase()).toBe(WALLET);
    expect(decoded.args[1]).toBe(parseEther("50.5"));
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

    const decoded = decodeFunctionData({
      abi: STREAM_ABI,
      data: built.tx.data,
    });
    // 86400 tokens/day = 1 token/second = 1e18 wei/second
    expect(decoded.args[2]).toBe(10n ** 18n);
  });

  it("stops the stream at zero", () => {
    const built = buildStreamTx({
      tokenAddress: TOKEN,
      receiver: WALLET,
      tokensPerDay: "0",
    });
    const decoded = decodeFunctionData({
      abi: STREAM_ABI,
      data: built.tx.data,
    });
    expect(decoded.args[2]).toBe(0n);
    expect(built.description).toContain("Stop");
  });
});

describe("buildBuyTx", () => {
  it("encodes a zap with slippage from the injected quote", async () => {
    const built = await buildBuyTx({
      tokenAddress: TOKEN,
      ethAmount: "0.01",
      quotedAmountOut: 1_000_000n * 10n ** 18n,
      slippageBps: 100, // 1%
    });

    expect(built.tx.value).toBe(`0x${parseEther("0.01").toString(16)}`);
    expect(built.tx.chainId).toBe(BASE_CHAIN_ID);

    const decoded = decodeFunctionData({
      abi: parseAbi([
        "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) payable returns (uint256)",
      ]),
      data: built.tx.data,
    });
    expect((decoded.args[0] as string).toLowerCase()).toBe(TOKEN);
    expect(decoded.args[1]).toBe(parseEther("0.01"));
    // 1% slippage off 1M tokens
    expect(decoded.args[2]).toBe(990_000n * 10n ** 18n);
    // no stake → zero staking contract
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
      abi: parseAbi([
        "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) payable returns (uint256)",
      ]),
      data: built.tx.data,
    });
    expect((decoded.args[3] as string).toLowerCase()).toBe(STAKING);
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
