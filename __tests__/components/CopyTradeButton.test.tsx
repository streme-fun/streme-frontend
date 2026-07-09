/**
 * Copy-trade tests (plan U6) — the eligibility matrix, stake clamping, and
 * mini-app tx shaping as pure logic, plus the CopyTradeButton component over
 * mocked wallet/provider/network seams.
 *
 * First component test in the repo: wallet hooks, wagmi, posthog, sonner,
 * and the viem client are all mocked at the module boundary so the test
 * exercises the component's decision flow, not the wallet stack.
 */

import { beforeEach, describe, expect, it } from "@jest/globals";
// Matcher type augmentation for the @jest/globals `expect` used here
// (jest.setup.js loads the matchers themselves at runtime).
import "@testing-library/jest-dom/jest-globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mockCapture = jest.fn();

jest.mock("@/src/hooks/useUnifiedWallet", () => ({
  useUnifiedWallet: jest.fn(),
}));
jest.mock("@/src/hooks/useAppFrameLogic", () => ({
  useAppFrameLogic: jest.fn(),
}));
jest.mock("wagmi", () => ({
  useWalletClient: jest.fn(),
}));
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));
jest.mock("sonner", () => ({
  toast: {
    loading: jest.fn(() => "toast-id"),
    success: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("@/src/lib/viemClient", () => ({
  publicClient: {
    readContract: jest.fn(),
    waitForTransactionReceipt: jest.fn(),
  },
}));

import { toast } from "sonner";
import { useWalletClient } from "wagmi";
import CopyTradeButton from "@/src/components/floor/CopyTradeButton";
import {
  COPY_TRADE_RISK_COPY,
  DEFAULT_BUY_SUBSTITUTE_ETH,
  isCopyEligible,
  parseEthInput,
  resolveStakeAmount,
  shapeBuyCopyRequest,
  shapeBuySubstituteRequest,
  shapeMiniAppTxParams,
  shapeStakeCopyRequest,
  toChainIdHex,
} from "@/src/components/floor/copyTradeLogic";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useUnifiedWallet } from "@/src/hooks/useUnifiedWallet";
import type { BuiltTransaction } from "@/src/lib/agent/txBuilders";
import type { FloorEvent } from "@/src/lib/floor/store";
import { publicClient } from "@/src/lib/viemClient";

const mockUseUnifiedWallet = useUnifiedWallet as unknown as jest.Mock;
const mockUseAppFrameLogic = useAppFrameLogic as unknown as jest.Mock;
const mockUseWalletClient = useWalletClient as unknown as jest.Mock;
const mockReadContract = publicClient.readContract as unknown as jest.Mock;
const mockWaitForReceipt =
  publicClient.waitForTransactionReceipt as unknown as jest.Mock;

const VIEWER = "0x9999999999999999999999999999999999999999";
const TOKEN = "0x2222222222222222222222222222222222222222";

function makeEvent(overrides: Partial<FloorEvent> = {}): FloorEvent {
  return {
    txHash: "0xaaaa000000000000000000000000000000000000000000000000000000000001",
    block: "123",
    at: Date.now(),
    kind: "buy",
    wallet: "0x1111111111111111111111111111111111111111",
    token: TOKEN,
    amountEth: "0.05",
    tier: 1,
    source: "agent",
    staked: true,
    description: "bought 0.05 ETH of TEST and staked it",
    ...overrides,
  };
}

const BUILT: BuiltTransaction = {
  description: "Swap 0.05 ETH for TEST and stake it",
  tx: {
    to: "0x3333333333333333333333333333333333333333",
    data: "0xdeadbeef5354524d0102000000000000000000aabbccdd",
    value: "0xb1a2bc2ec50000",
    chainId: 8453,
  },
  notes: [],
};

const fetchMock = jest.fn();

function mockBuildSuccess(built: BuiltTransaction = BUILT) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => built,
  });
}

function connectedWallet(overrides: Record<string, unknown> = {}) {
  return {
    isConnected: true,
    address: VIEWER,
    connect: jest.fn(),
    isEffectivelyMiniApp: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockUseUnifiedWallet.mockReturnValue(connectedWallet());
  mockUseAppFrameLogic.mockReturnValue({
    getSafeEthereumProvider: jest.fn(),
  });
  mockUseWalletClient.mockReturnValue({ data: undefined });
  mockReadContract.mockResolvedValue(0n);
  mockWaitForReceipt.mockResolvedValue({ status: "success" });
});

// ---------------------------------------------------------------------------
// Pure logic: eligibility matrix
// ---------------------------------------------------------------------------

describe("isCopyEligible — the matrix", () => {
  it("allows tier 1 and tier 2 buys and stakes with a token", () => {
    expect(isCopyEligible(makeEvent({ tier: 1, kind: "buy" }))).toBe(true);
    expect(isCopyEligible(makeEvent({ tier: 2, kind: "buy" }))).toBe(true);
    expect(
      isCopyEligible(makeEvent({ tier: 1, kind: "stake", amountToken: "10" }))
    ).toBe(true);
    expect(
      isCopyEligible(makeEvent({ tier: 2, kind: "stake", amountToken: "10" }))
    ).toBe(true);
  });

  it("never allows tier 3 (spoofed-honeypot guard), even for buys", () => {
    expect(isCopyEligible(makeEvent({ tier: 3, kind: "buy" }))).toBe(false);
    expect(isCopyEligible(makeEvent({ tier: 3, kind: "stake" }))).toBe(false);
  });

  it("never allows unstake, stream, connect, or stake_refunded", () => {
    for (const kind of [
      "unstake",
      "stream",
      "connect",
      "stake_refunded",
    ] as const) {
      expect(isCopyEligible(makeEvent({ tier: 1, kind }))).toBe(false);
    }
  });

  it("requires a token address, and an ETH amount for buys", () => {
    expect(isCopyEligible(makeEvent({ token: undefined }))).toBe(false);
    expect(
      isCopyEligible(makeEvent({ kind: "buy", amountEth: undefined }))
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pure logic: stake clamping
// ---------------------------------------------------------------------------

describe("resolveStakeAmount — clamp matrix", () => {
  const ONE = 10n ** 18n;

  it("stakes the original amount when balance covers it", () => {
    const resolved = resolveStakeAmount(100n * ONE, "40");
    expect(resolved).toEqual({
      mode: "stake",
      amountWei: 40n * ONE,
      amountTokens: "40",
      clamped: false,
    });
  });

  it("clamps to the viewer balance when 0 < balance < original", () => {
    const resolved = resolveStakeAmount(40n * ONE, "100");
    expect(resolved).toEqual({
      mode: "stake",
      amountWei: 40n * ONE,
      amountTokens: "40",
      clamped: true,
    });
  });

  it("falls to buy-substitute on zero balance", () => {
    expect(resolveStakeAmount(0n, "100")).toEqual({ mode: "buy_substitute" });
  });

  it("falls to buy-substitute on missing or unparseable original amount", () => {
    expect(resolveStakeAmount(40n * ONE, undefined)).toEqual({
      mode: "buy_substitute",
    });
    expect(resolveStakeAmount(40n * ONE, "not-a-number")).toEqual({
      mode: "buy_substitute",
    });
  });
});

// ---------------------------------------------------------------------------
// Pure logic: request + mini-app tx shaping
// ---------------------------------------------------------------------------

describe("request shaping", () => {
  it("buy copy carries original ETH size, staked flag, and floor-ui source", () => {
    expect(shapeBuyCopyRequest(makeEvent({ staked: false }))).toEqual({
      action: "buy",
      body: {
        tokenAddress: TOKEN,
        ethAmount: "0.05",
        stake: false,
        source: "floor-ui",
      },
    });
  });

  it("stake copy carries the resolved amount and floor-ui source", () => {
    expect(shapeStakeCopyRequest(makeEvent({ kind: "stake" }), "40")).toEqual({
      action: "stake",
      body: { tokenAddress: TOKEN, amount: "40", source: "floor-ui" },
    });
  });

  it("buy-substitute always auto-stakes", () => {
    expect(
      shapeBuySubstituteRequest(makeEvent({ kind: "stake" }), "0.02")
    ).toEqual({
      action: "buy",
      body: {
        tokenAddress: TOKEN,
        ethAmount: "0.02",
        stake: true,
        source: "floor-ui",
      },
    });
  });
});

describe("shapeMiniAppTxParams", () => {
  it("converts chainId 8453 to hex 0x2105, passes value, keeps data intact", () => {
    expect(toChainIdHex(8453)).toBe("0x2105");
    const shaped = shapeMiniAppTxParams(BUILT.tx, VIEWER);
    expect(shaped).toEqual({
      to: BUILT.tx.to,
      from: VIEWER,
      data: BUILT.tx.data,
      value: BUILT.tx.value,
      chainId: "0x2105",
    });
  });

  it("omits value when the built tx has none (stake path)", () => {
    const shaped = shapeMiniAppTxParams(
      { to: BUILT.tx.to, data: "0xabcdef", chainId: 8453 },
      VIEWER
    );
    expect(shaped).not.toHaveProperty("value");
    expect(shaped.data).toBe("0xabcdef");
  });
});

describe("parseEthInput", () => {
  it("accepts positive decimals and rejects junk", () => {
    expect(parseEthInput(" 0.01 ")).toBe("0.01");
    expect(parseEthInput("1")).toBe("1");
    expect(parseEthInput("0")).toBeNull();
    expect(parseEthInput("-1")).toBeNull();
    expect(parseEthInput("abc")).toBeNull();
    expect(parseEthInput("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Component: rendering gates
// ---------------------------------------------------------------------------

describe("CopyTradeButton rendering gates", () => {
  it("renders nothing for tier-3 events", () => {
    const { container } = render(
      <CopyTradeButton event={makeEvent({ tier: 3 })} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for unstake/stream/connect/stake_refunded", () => {
    for (const kind of [
      "unstake",
      "stream",
      "connect",
      "stake_refunded",
    ] as const) {
      const { container } = render(
        <CopyTradeButton event={makeEvent({ kind })} />
      );
      expect(container).toBeEmptyDOMElement();
    }
  });

  it("shows 'Connect to copy' when disconnected and connects without erroring", () => {
    const connect = jest.fn();
    mockUseUnifiedWallet.mockReturnValue(
      connectedWallet({ isConnected: false, address: undefined, connect })
    );
    render(<CopyTradeButton event={makeEvent()} />);

    const button = screen.getByRole("button", { name: "Connect to copy" });
    fireEvent.click(button);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Component: buy copy flow
// ---------------------------------------------------------------------------

describe("CopyTradeButton buy copy", () => {
  it("rebuilds via the buy builder and shows description + risk framing before signing", async () => {
    mockBuildSuccess();
    render(<CopyTradeButton event={makeEvent()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy buy" }));

    await waitFor(() =>
      expect(screen.getByText(BUILT.description)).toBeInTheDocument()
    );
    expect(screen.getByText(COPY_TRADE_RISK_COPY)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/tx/buy",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      tokenAddress: TOKEN,
      ethAmount: "0.05",
      stake: true,
      source: "floor-ui",
    });

    // Confirm step only — nothing signed yet.
    expect(toast.loading).not.toHaveBeenCalled();
    expect(mockWaitForReceipt).not.toHaveBeenCalled();
  });

  it("becomes a disabled 'No longer available' state when the build fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Token is blacklisted" }),
    });
    render(<CopyTradeButton event={makeEvent()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy buy" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "No longer available" })
      ).toBeDisabled()
    );
    expect(screen.getByText("Token is blacklisted")).toBeInTheDocument();
    // No signable tx in this state.
    expect(toast.loading).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Component: stake copy flow
// ---------------------------------------------------------------------------

describe("CopyTradeButton stake copy", () => {
  const ONE = 10n ** 18n;

  it("clamps to the viewer balance and shows the clamped amount", async () => {
    mockReadContract.mockResolvedValue(40n * ONE);
    mockBuildSuccess({
      ...BUILT,
      description: "Stake 40 TEST",
      tx: { ...BUILT.tx, value: undefined },
    });
    render(
      <CopyTradeButton
        event={makeEvent({ kind: "stake", amountToken: "100" })}
      />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Copy stake" })
    );

    await waitFor(() =>
      expect(screen.getByText("Stake 40 TEST")).toBeInTheDocument()
    );
    expect(screen.getByText(/clamped to your/i)).toBeInTheDocument();

    const stakeCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/agent/tx/stake"
    );
    expect(stakeCall).toBeDefined();
    expect(JSON.parse(stakeCall![1].body)).toEqual({
      tokenAddress: TOKEN,
      amount: "40",
      source: "floor-ui",
    });
  });

  it("offers buy & auto-stake with an editable 0.01 ETH default on zero balance", async () => {
    mockReadContract.mockResolvedValue(0n);
    mockBuildSuccess({ ...BUILT, description: "Buy and stake TEST" });
    render(
      <CopyTradeButton
        event={makeEvent({ kind: "stake", amountToken: "100" })}
      />
    );

    // Zero balance flips the idle label to the buy substitute.
    const button = await screen.findByRole("button", {
      name: "Buy & auto-stake instead",
    });
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByText("Buy and stake TEST")).toBeInTheDocument()
    );
    expect(screen.getByText(COPY_TRADE_RISK_COPY)).toBeInTheDocument();

    const input = screen.getByLabelText("ETH amount to buy and auto-stake");
    expect(input).toHaveValue(DEFAULT_BUY_SUBSTITUTE_ETH);

    const buyCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/agent/tx/buy"
    );
    expect(buyCall).toBeDefined();
    expect(JSON.parse(buyCall![1].body)).toEqual({
      tokenAddress: TOKEN,
      ethAmount: DEFAULT_BUY_SUBSTITUTE_ETH,
      stake: true,
      source: "floor-ui",
    });
  });
});

// ---------------------------------------------------------------------------
// Component: signing paths
// ---------------------------------------------------------------------------

describe("CopyTradeButton signing", () => {
  it("mini-app path sends eth_sendTransaction with chainId 0x2105 and value passthrough (AE4)", async () => {
    const request = jest.fn().mockResolvedValue("0xhash");
    mockUseUnifiedWallet.mockReturnValue(
      connectedWallet({ isEffectivelyMiniApp: true })
    );
    mockUseAppFrameLogic.mockReturnValue({
      getSafeEthereumProvider: jest.fn().mockResolvedValue({ request }),
    });
    mockBuildSuccess();
    render(<CopyTradeButton event={makeEvent()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy buy" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm & sign" })
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(request).toHaveBeenCalledWith({
      method: "eth_sendTransaction",
      params: [
        {
          to: BUILT.tx.to,
          from: VIEWER,
          data: BUILT.tx.data,
          value: BUILT.tx.value,
          chainId: "0x2105",
        },
      ],
    });
    expect(mockWaitForReceipt).toHaveBeenCalledWith({ hash: "0xhash" });
    expect(mockCapture).toHaveBeenCalledWith(
      "copy_trade_success",
      expect.objectContaining({
        token_address: TOKEN,
        copy_mode: "buy",
        is_mini_app: true,
      })
    );
  });

  it("browser path signs through walletClient with the built value", async () => {
    const sendTransaction = jest.fn().mockResolvedValue("0xbrowserhash");
    mockUseWalletClient.mockReturnValue({ data: { sendTransaction } });
    mockBuildSuccess();
    render(<CopyTradeButton event={makeEvent()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy buy" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm & sign" })
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(sendTransaction).toHaveBeenCalledWith({
      to: BUILT.tx.to,
      data: BUILT.tx.data,
      value: BigInt(BUILT.tx.value!),
      account: VIEWER,
      chain: undefined,
    });
    expect(mockWaitForReceipt).toHaveBeenCalledWith({ hash: "0xbrowserhash" });
  });
});
