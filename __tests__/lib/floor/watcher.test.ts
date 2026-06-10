// Watcher tests (plan U4) — fake WatcherClient + the floor store's
// in-memory fallback (no Redis env). Inputs are crafted with the REAL
// builders (buildStakeTx/buildBuyTx) and the real watermark/fingerprint
// helpers so the watcher's decoders see production-shaped bytes.

import { beforeEach, describe, expect, it } from "@jest/globals";

// Wrap bumpVerifiedCounters in jest.fn so the publish-vs-counters failure
// test can inject a one-shot rejection; every other call passes through to
// the real (in-memory) store. Uses the global `jest` so the transform
// hoists this above the module imports.
jest.mock("@/src/lib/floor/store", () => {
  const actual = jest.requireActual(
    "@/src/lib/floor/store"
  ) as typeof import("@/src/lib/floor/store");
  return {
    ...actual,
    bumpVerifiedCounters: jest.fn(actual.bumpVerifiedCounters),
  };
});

import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
  parseEther,
  type Hex,
} from "viem";

import { encodeZapData } from "@/src/lib/abiEncoding";
import {
  buildBuyTx,
  buildConnectPoolTx,
  buildStakeTx,
  STAKING_HELPER,
} from "@/src/lib/agent/txBuilders";
import {
  findWatermark,
  fingerprint,
  WATERMARK_LENGTH,
} from "@/src/lib/agent/watermark";
import { ZAP_CONTRACT_ADDRESS } from "@/src/lib/contracts";
import {
  __clearFloorStoreForTests,
  acquireLock,
  bumpVerifiedCounters,
  floorDateKey,
  getCursor,
  getNonceIndex,
  getRecentEvents,
  getVerifiedCounters,
  putFingerprint,
  putNonceIndex,
  setCursor,
} from "@/src/lib/floor/store";
import { recordBuild } from "@/src/lib/floor/telemetry";
import {
  runWatcher,
  type WatcherClient,
  type WatcherLog,
  type WatcherReceiptLog,
  type WatcherResult,
  type WatcherRunReport,
  type WatcherTx,
} from "@/src/lib/floor/watcher";

type Address = `0x${string}`;

const TOKEN: Address = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
const STAKING_CONTRACT: Address = "0x93419f1c0f73b278c73085c17407794a6580deff";
const WALLET: Address = "0x1111111111111111111111111111111111111111";
const ENTRYPOINT: Address = "0x4337433743374337433743374337433743374337";
const ZERO: Address = "0x0000000000000000000000000000000000000000";
const POOL: Address = "0x2222222222222222222222222222222222222222";

/** All fake blocks share one timestamp → one UTC counter date. */
const BLOCK_TS_SEC = 1_900_000_000n;
const DATE = floorDateKey(Number(BLOCK_TS_SEC) * 1000);

function txHashOf(i: number): Hex {
  return `0x${i.toString(16).padStart(64, "0")}` as Hex;
}
const TX1 = txHashOf(1);
const TX2 = txHashOf(2);
const TX3 = txHashOf(3);

// ---------------------------------------------------------------------------
// Fake client factory
// ---------------------------------------------------------------------------

type LogEventName = "Sent" | "Withdraw" | "FlowUpdated";

interface FakeChain {
  head: bigint;
  logs: Record<LogEventName, WatcherLog[]>;
  /** blockNumber (decimal string) → txs in that block */
  blocks: Map<string, WatcherTx[]>;
  /** txHash (lowercase) → tx, for getTransaction */
  txs: Map<string, WatcherTx>;
  /** txHash (lowercase) → receipt logs */
  receipts: Map<string, WatcherReceiptLog[]>;
  /** txHashes (lowercase) whose receipts report status "reverted" */
  reverted: Set<string>;
  /** StakedToken contract (lowercase) → stakeableToken() answer */
  stakeableTokens: Map<string, string>;
  /** When true, getLogs respects fromBlock/toBlock (default: re-deliver all) */
  filterLogsByRange: boolean;
  /** getLogs throws for any range starting at or above this block */
  failGetLogsAtOrAbove: bigint | null;
}

function makeChain(overrides: Partial<FakeChain> = {}): FakeChain {
  return {
    // Default window: cursor "999" (set in beforeEach) + head 1017 −
    // confirmation depth 15 → one chunk covering blocks 1000–1002.
    head: 1017n,
    logs: { Sent: [], Withdraw: [], FlowUpdated: [] },
    blocks: new Map(),
    txs: new Map(),
    receipts: new Map(),
    reverted: new Set(),
    stakeableTokens: new Map([[STAKING_CONTRACT, TOKEN]]),
    filterLogsByRange: false,
    failGetLogsAtOrAbove: null,
    ...overrides,
  };
}

function makeClient(chain: FakeChain): WatcherClient {
  return {
    async getBlockNumber() {
      return chain.head;
    },
    async getLogs({ event, fromBlock, toBlock }) {
      if (
        chain.failGetLogsAtOrAbove !== null &&
        fromBlock >= chain.failGetLogsAtOrAbove
      ) {
        throw new Error("rpc unavailable");
      }
      const name = (event as { name?: string }).name as LogEventName;
      const logs = chain.logs[name] ?? [];
      if (!chain.filterLogsByRange) return logs;
      return logs.filter(
        (log) => log.blockNumber >= fromBlock && log.blockNumber <= toBlock
      );
    },
    async getBlock({ blockNumber }) {
      return {
        timestamp: BLOCK_TS_SEC,
        transactions: chain.blocks.get(blockNumber.toString()) ?? [],
      };
    },
    async getTransaction({ hash }) {
      const tx = chain.txs.get(hash.toLowerCase());
      if (!tx) throw new Error(`fake chain has no tx ${hash}`);
      return tx;
    },
    async getTransactionReceipt({ hash }) {
      return {
        status: chain.reverted.has(hash.toLowerCase())
          ? ("reverted" as const)
          : ("success" as const),
        logs: chain.receipts.get(hash.toLowerCase()) ?? [],
      };
    },
    async readContract({ address, functionName }) {
      if (functionName !== "stakeableToken") {
        throw new Error(`unexpected readContract: ${functionName}`);
      }
      const token = chain.stakeableTokens.get(address.toLowerCase());
      if (!token) throw new Error("execution reverted");
      return token;
    },
  };
}

function asReport(result: WatcherResult): WatcherRunReport {
  if (result.skipped) throw new Error("watcher unexpectedly locked");
  return result;
}

// ---------------------------------------------------------------------------
// Scenario builders
// ---------------------------------------------------------------------------

const SEND_ABI = parseAbi([
  "function send(address recipient, uint256 amount, bytes userData)",
]);
const DEPOSIT_ABI = parseAbi([
  "event Deposit(address indexed account, uint256 depositTimestamp, uint256 amount)",
]);

/** Receipt log shaped exactly like a StakedToken Deposit. */
function depositLog(
  emitter: Address,
  account: Address,
  amount: bigint
): WatcherReceiptLog {
  return {
    address: emitter,
    topics: encodeEventTopics({
      abi: DEPOSIT_ABI,
      eventName: "Deposit",
      args: { account },
    }) as Hex[],
    data: encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }],
      [1234n, amount]
    ),
  };
}

/** Wire one stake into the chain: Sent log + tx + receipt. */
function addStakeTx(
  chain: FakeChain,
  opts: {
    txHash: Hex;
    block: bigint;
    amountWei: bigint;
    /** ERC777 userData — the Sent log's `data` arg (decoded by the watcher) */
    userData: Hex;
    input: Hex;
    deposit: boolean;
    wallet?: Address;
  }
): void {
  const wallet = opts.wallet ?? WALLET;
  chain.logs.Sent.push({
    address: TOKEN,
    blockNumber: opts.block,
    transactionHash: opts.txHash,
    args: {
      operator: wallet,
      from: wallet,
      to: STAKING_HELPER,
      amount: opts.amountWei,
      data: opts.userData,
      operatorData: "0x",
    },
  });
  chain.txs.set(opts.txHash.toLowerCase(), {
    hash: opts.txHash,
    from: wallet,
    to: TOKEN,
    input: opts.input,
    value: 0n,
  });
  chain.receipts.set(
    opts.txHash.toLowerCase(),
    opts.deposit ? [depositLog(STAKING_CONTRACT, wallet, opts.amountWei)] : []
  );
}

/**
 * Build a real stake via buildStakeTx, record it through the real telemetry
 * path (fingerprint + nonce index → tier 1), and wire it into the chain.
 */
async function seedTier1Stake(
  chain: FakeChain,
  opts: {
    amount?: string;
    deposit?: boolean;
    txHash?: Hex;
    block?: bigint;
  } = {}
): Promise<void> {
  const amount = opts.amount ?? "100";
  const built = buildStakeTx({
    tokenAddress: TOKEN,
    amount,
    agentId: "alice-bot",
  });
  await recordBuild({
    tool: "build_stake_transaction",
    agentId: "alice-bot",
    to: built.tx.to,
    data: built.tx.data,
  });
  // The Sent log's userData is the third send() arg — the watermark.
  const userData = decodeFunctionData({ abi: SEND_ABI, data: built.tx.data })
    .args[2] as Hex;
  addStakeTx(chain, {
    txHash: opts.txHash ?? TX1,
    block: opts.block ?? 1000n,
    amountWei: parseEther(amount),
    userData,
    input: built.tx.data,
    deposit: opts.deposit ?? true,
  });
}

/** Put a buy-shaped tx into a block (zap buys are block-scan discovered). */
function addBuyTx(
  chain: FakeChain,
  opts: {
    txHash: Hex;
    block: bigint;
    to: Address;
    input: Hex;
    valueWei: bigint;
    wallet?: Address;
    receiptLogs?: WatcherReceiptLog[];
  }
): void {
  const txs = chain.blocks.get(opts.block.toString()) ?? [];
  const tx: WatcherTx = {
    hash: opts.txHash,
    from: opts.wallet ?? WALLET,
    to: opts.to,
    input: opts.input,
    value: opts.valueWei,
  };
  txs.push(tx);
  chain.blocks.set(opts.block.toString(), txs);
  chain.txs.set(opts.txHash.toLowerCase(), tx);
  chain.receipts.set(opts.txHash.toLowerCase(), opts.receiptLogs ?? []);
}

async function buildBuy(opts: { ethAmount?: string; agentId?: string } = {}) {
  return buildBuyTx({
    tokenAddress: TOKEN,
    ethAmount: opts.ethAmount ?? "0.01",
    quotedAmountOut: parseEther("1000"),
    agentId: opts.agentId ?? "alice-bot",
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.VERCEL_ENV;
  delete process.env.RESIDENT_ADDRESS;
  __clearFloorStoreForTests();
  await setCursor("999"); // default window: blocks 1000–1002 (head 1017)
});

// ---------------------------------------------------------------------------
// Stakes
// ---------------------------------------------------------------------------

describe("watcher stakes", () => {
  it("publishes a watermarked stake with a Deposit receipt as tier 1 and bumps counters", async () => {
    const chain = makeChain();
    await seedTier1Stake(chain);

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.errors).toEqual([]);
    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(1);

    const events = await getRecentEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "stake",
      tier: 1,
      agentId: "alice-bot",
      wallet: WALLET,
      token: TOKEN,
      amountToken: "100",
      source: "agent",
      block: "1000",
    });

    const counters = await getVerifiedCounters(DATE);
    expect(counters.byKind.stake).toBe(1);
    expect(counters.activeWallets).toBe(1);
    expect(await getCursor()).toBe("1002");
  });

  it("publishes the refund branch (no Deposit) as stake_refunded and never bumps counters", async () => {
    const chain = makeChain();
    await seedTier1Stake(chain, { deposit: false });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(0);

    const events = await getRecentEvents(10);
    expect(events[0].kind).toBe("stake_refunded");
    expect(events[0].tier).toBe(1); // verified, just refunded

    const counters = await getVerifiedCounters(DATE);
    expect(counters.byKind.stake).toBe(0);
    expect(counters.activeWallets).toBe(0);
  });

  it("drops 1-wei AutoStaker dust and publishes below-floor stakes without counting", async () => {
    const chain = makeChain();
    // Below STAKE_FLOOR_WEI (1e15): 0.0001 tokens = 1e14 wei.
    await seedTier1Stake(chain, { amount: "0.0001", txHash: TX1 });
    // 1-wei AutoStaker dust — filtered before it ever becomes a candidate.
    addStakeTx(chain, {
      txHash: TX2,
      block: 1000n,
      amountWei: 1n,
      userData: "0x",
      input: "0x",
      deposit: true,
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(0);

    const events = await getRecentEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "stake", belowFloor: true });
    expect((await getVerifiedCounters(DATE)).byKind.stake).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Buys + tiers
// ---------------------------------------------------------------------------

describe("watcher buys and verification tiers", () => {
  it("publishes a watermark-only zap buy (expired records) as tier 3 with no attribution or counters", async () => {
    const chain = makeChain();
    const built = await buildBuy(); // watermarked, but NOT recorded (expired)
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ZAP_CONTRACT_ADDRESS,
      input: built.tx.data,
      valueWei: 10n ** 16n, // 0.01 ETH — above the buy floor
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(0);

    const events = await getRecentEvents(10);
    expect(events[0]).toMatchObject({
      kind: "buy",
      tier: 3,
      agentId: null,
      token: TOKEN, // decoded from the zap calldata
      amountEth: "0.01",
    });
    const counters = await getVerifiedCounters(DATE);
    expect(counters.byKind.buy).toBe(0);
    expect(counters.volumeEth).toBe(0);
  });

  it("treats third-party crafted magic bytes as tier 3 — no badge, no counters (plan R20)", async () => {
    const chain = makeChain();
    // A spoofer can forge the 18-byte layout but holds no telemetry record.
    const spoofedWatermark =
      "5354524d" + "01" + "01" + "00".repeat(8) + "deadbeef";
    const input = (encodeZapData("zap", TOKEN, 10n ** 16n, 1n, ZERO) +
      spoofedWatermark) as Hex;
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ZAP_CONTRACT_ADDRESS,
      input,
      valueWei: 10n ** 16n,
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(0);
    const events = await getRecentEvents(10);
    expect(events[0]).toMatchObject({ kind: "buy", tier: 3, agentId: null });
    expect((await getVerifiedCounters(DATE)).byKind.buy).toBe(0);
  });

  it("resolves tier 2 through the nonce → fingerprint join for wrapped calldata", async () => {
    const chain = makeChain();
    const built = await buildBuy();
    // Telemetry recorded the BUILT calldata; on-chain it arrives wrapped in
    // smart-wallet calldata, so fingerprint(tx.to, tx.input) misses and only
    // the watermark nonce joins back: nonce → fp → record.
    const nonce = findWatermark(built.tx.data)!.nonce;
    const builtFp = fingerprint(built.tx.to, built.tx.data);
    await putFingerprint(builtFp, {
      tool: "build_buy_transaction",
      agentId: "alice-bot",
      builtAt: Date.now(),
      nonce,
    });
    await putNonceIndex(nonce, builtFp);

    const wrapped = ("0xdeadbeef" + built.tx.data.slice(2)) as Hex;
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ENTRYPOINT, // 4337-style: tx targets the entrypoint, not the zap
      input: wrapped,
      valueWei: 10n ** 16n,
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(1);

    const events = await getRecentEvents(10);
    expect(events[0]).toMatchObject({
      kind: "buy",
      tier: 2,
      agentId: "alice-bot",
    });
    const counters = await getVerifiedCounters(DATE);
    expect(counters.byKind.buy).toBe(1);
    expect(counters.volumeEth).toBeCloseTo(0.01);
  });

  it("denies tier 2 to a harvested nonce in fresh direct calldata and consumes the nonce on first wrapped match", async () => {
    const chain = makeChain();
    const built = await buildBuy();
    const nonce = findWatermark(built.tx.data)!.nonce;
    const builtFp = fingerprint(built.tx.to, built.tx.data);
    await putFingerprint(builtFp, {
      tool: "build_buy_transaction",
      agentId: "alice-bot",
      builtAt: Date.now(),
      nonce,
    });
    await putNonceIndex(nonce, builtFp);

    // Attacker harvests the watermark (the built tx's trailing 18 bytes)
    // and pastes it onto FRESH direct-to-zap calldata. The fingerprint
    // misses, and the nonce join must NOT rescue a direct tx → tier 3.
    const harvestedWatermark = built.tx.data.slice(-WATERMARK_LENGTH * 2);
    const harvested = (encodeZapData("zap", TOKEN, 10n ** 16n, 1n, ZERO) +
      harvestedWatermark) as Hex;
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ZAP_CONTRACT_ADDRESS,
      input: harvested,
      valueWei: 10n ** 16n,
    });

    // The legitimate wrapped (4337-style) tx earns tier 2 — and consumes.
    const wrapped = ("0xdeadbeef" + built.tx.data.slice(2)) as Hex;
    addBuyTx(chain, {
      txHash: TX2,
      block: 1001n,
      to: ENTRYPOINT,
      input: wrapped,
      valueWei: 10n ** 16n,
    });

    // Replay: the same watermark wrapped again in a later tx → nonce gone.
    const replay = ("0xfeedface" + built.tx.data.slice(2)) as Hex;
    addBuyTx(chain, {
      txHash: TX3,
      block: 1002n,
      to: ENTRYPOINT,
      input: replay,
      valueWei: 10n ** 16n,
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(3); // all publish — only one verifies
    expect(report.counterBumps).toBe(1); // only the legit wrapped tx counts

    const events = await getRecentEvents(10);
    const byHash = new Map(events.map((event) => [event.txHash, event]));
    expect(byHash.get(TX1)).toMatchObject({ tier: 3, agentId: null });
    expect(byHash.get(TX2)).toMatchObject({ tier: 2, agentId: "alice-bot" });
    expect(byHash.get(TX3)).toMatchObject({ tier: 3, agentId: null });

    expect(await getNonceIndex(nonce)).toBeNull(); // single-use: consumed
    expect((await getVerifiedCounters(DATE)).byKind.buy).toBe(1);
  });

  it("reconciles a zap auto-stake (buy + interior Sent/Deposit) to exactly one buy event", async () => {
    const chain = makeChain();
    const built = await buildBuy({ ethAmount: "0.05" });
    await recordBuild({
      tool: "build_buy_transaction",
      agentId: "alice-bot",
      to: built.tx.to,
      data: built.tx.data,
    });
    // One tx: the zap call (block scan) whose receipt also stakes...
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ZAP_CONTRACT_ADDRESS,
      input: built.tx.data,
      valueWei: 5n * 10n ** 16n,
      receiptLogs: [depositLog(STAKING_CONTRACT, WALLET, parseEther("995"))],
    });
    // ...and emits an interior Sent to the StakingHelper in the SAME tx.
    chain.logs.Sent.push({
      address: TOKEN,
      blockNumber: 1000n,
      transactionHash: TX1,
      args: {
        operator: ZAP_CONTRACT_ADDRESS,
        from: ZAP_CONTRACT_ADDRESS,
        to: STAKING_HELPER,
        amount: parseEther("995"),
        data: "0x",
        operatorData: "0x",
      },
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.discovered).toBe(2); // buy + interior stake candidates
    expect(report.published).toBe(1); // reconciled to ONE event
    expect(report.counterBumps).toBe(1);

    const events = await getRecentEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "buy", tier: 1, staked: true });

    const counters = await getVerifiedCounters(DATE);
    expect(counters.byKind.buy).toBe(1);
    expect(counters.byKind.stake).toBe(0);
    expect(counters.volumeEth).toBeCloseTo(0.05);
  });
});

// ---------------------------------------------------------------------------
// Receipt status: reverted txs never publish
// ---------------------------------------------------------------------------

describe("watcher reverted transactions", () => {
  it("never publishes a reverted zap buy", async () => {
    const chain = makeChain();
    const built = await buildBuy();
    await recordBuild({
      tool: "build_buy_transaction",
      agentId: "alice-bot",
      to: built.tx.to,
      data: built.tx.data,
    });
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ZAP_CONTRACT_ADDRESS,
      input: built.tx.data,
      valueWei: 10n ** 16n,
    });
    chain.reverted.add(TX1);

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(0);
    expect(report.counterBumps).toBe(0);
    expect(await getRecentEvents(10)).toEqual([]);
  });

  it("publishes a successful connect but never a reverted one", async () => {
    const chain = makeChain();
    // Two distinct builds (fresh nonces) for the same pool — both recorded.
    const ok = buildConnectPoolTx({ poolAddress: POOL, agentId: "alice-bot" });
    const fail = buildConnectPoolTx({
      poolAddress: POOL,
      agentId: "alice-bot",
    });
    await recordBuild({
      tool: "build_connect_pool_transaction",
      agentId: "alice-bot",
      to: ok.tx.to,
      data: ok.tx.data,
    });
    await recordBuild({
      tool: "build_connect_pool_transaction",
      agentId: "alice-bot",
      to: fail.tx.to,
      data: fail.tx.data,
    });
    // addBuyTx is a generic put-tx-in-block helper despite the name.
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ok.tx.to,
      input: ok.tx.data,
      valueWei: 0n,
    });
    addBuyTx(chain, {
      txHash: TX2,
      block: 1001n,
      to: fail.tx.to,
      input: fail.tx.data,
      valueWei: 0n,
    });
    chain.reverted.add(TX2);

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(1);

    const events = await getRecentEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "connect",
      tier: 1,
      txHash: TX1,
      token: POOL,
    });
    expect((await getVerifiedCounters(DATE)).byKind.connect).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Run mechanics: dedupe, cursor on failure, lock, dry run
// ---------------------------------------------------------------------------

describe("watcher run mechanics", () => {
  it("dedupes the same log delivered across two runs (seen barrier)", async () => {
    const chain = makeChain();
    await seedTier1Stake(chain);
    const client = makeClient(chain);

    const first = asReport(await runWatcher({ client }));
    expect(first.published).toBe(1);
    expect(await getCursor()).toBe("1002");

    // Advance head; the fake re-delivers the same Sent log in the new range.
    chain.head = 1020n; // next window: 1003–1005
    const second = asReport(await runWatcher({ client }));

    expect(second.published).toBe(0);
    expect(second.skippedCandidates).toBeGreaterThanOrEqual(1);
    expect(await getRecentEvents(10)).toHaveLength(1);
    expect((await getVerifiedCounters(DATE)).byKind.stake).toBe(1);
  });

  it("never advances the cursor past a failed chunk; a healthy rerun reprocesses it", async () => {
    // Two chunks: 1000–1149 (ok) and 1150–1160 (getLogs throws). The stake
    // sits in the failing chunk.
    const chain = makeChain({
      head: 1175n,
      filterLogsByRange: true,
      failGetLogsAtOrAbove: 1150n,
    });
    await seedTier1Stake(chain, { block: 1155n });
    const client = makeClient(chain);

    const first = asReport(await runWatcher({ client }));
    expect(first.errors).toHaveLength(1);
    expect(first.errors[0]).toContain("chunk 1150-1160");
    expect(first.processedTo).toBe("1149");
    expect(first.published).toBe(0);
    expect(await getCursor()).toBe("1149");
    expect(await getRecentEvents(10)).toHaveLength(0);

    // RPC recovers — the next run picks up exactly where the failure left off.
    chain.failGetLogsAtOrAbove = null;
    const second = asReport(await runWatcher({ client }));
    expect(second.errors).toEqual([]);
    expect(second.processedFrom).toBe("1150");
    expect(second.published).toBe(1);
    expect(await getCursor()).toBe("1160");
    expect((await getRecentEvents(10))[0].kind).toBe("stake");
  });

  it("skips entirely when the run lock is held", async () => {
    await acquireLock("watcher", 60);
    const result = await runWatcher({ client: makeClient(makeChain()) });
    expect(result).toEqual({ skipped: "locked" });
  });

  it("dry run reports work but writes nothing — no events, counters, or cursor", async () => {
    const chain = makeChain();
    await seedTier1Stake(chain);

    const report = asReport(
      await runWatcher({ client: makeClient(chain), dryRun: true })
    );

    expect(report.dryRun).toBe(true);
    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(1);
    expect(await getRecentEvents(10)).toEqual([]);
    expect(await getCursor()).toBe("999");
    expect((await getVerifiedCounters(DATE)).byKind.stake).toBe(0);
  });

  it("undercounts but never double-publishes when the counter bump fails after publish", async () => {
    const chain = makeChain();
    await seedTier1Stake(chain);
    const client = makeClient(chain);
    (bumpVerifiedCounters as unknown as jest.Mock).mockRejectedValueOnce(
      new Error("redis down")
    );

    const first = asReport(await runWatcher({ client }));
    expect(first.errors).toHaveLength(1);
    expect(first.errors[0]).toContain("redis down");
    expect(first.published).toBe(1); // the event went out before the crash
    expect(first.counterBumps).toBe(0);
    expect(await getRecentEvents(10)).toHaveLength(1);
    expect(await getCursor()).toBe("999"); // failed chunk not committed

    // Healthy rerun reprocesses the same range; the seen barrier holds.
    const second = asReport(await runWatcher({ client }));
    expect(second.errors).toEqual([]);
    expect(second.published).toBe(0);
    expect(await getRecentEvents(10)).toHaveLength(1); // no duplicate event
    // The missed bump is never retried: counters may undercount (benign,
    // visible) but can never double-count.
    expect((await getVerifiedCounters(DATE)).byKind.stake).toBe(0);
    expect(await getCursor()).toBe("1002");
  });

  it("orders one chunk's feed newest-block-first across discovery sources", async () => {
    const chain = makeChain();
    // Stake in block 1000 — log-anchored, discovered AFTER the block scan.
    await seedTier1Stake(chain, { txHash: TX1, block: 1000n });
    // Buy in block 1001 — block-scanned, discovered FIRST despite being newer.
    const built = await buildBuy();
    await recordBuild({
      tool: "build_buy_transaction",
      agentId: "alice-bot",
      to: built.tx.to,
      data: built.tx.data,
    });
    addBuyTx(chain, {
      txHash: TX2,
      block: 1001n,
      to: ZAP_CONTRACT_ADDRESS,
      input: built.tx.data,
      valueWei: 10n ** 16n,
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));
    expect(report.published).toBe(2);

    const events = await getRecentEvents(10);
    expect(events.map((event) => event.block)).toEqual(["1001", "1000"]);
    expect(events.map((event) => event.kind)).toEqual(["buy", "stake"]);
  });
});

// ---------------------------------------------------------------------------
// Counter eligibility: daily cap + resident split
// ---------------------------------------------------------------------------

describe("watcher counter eligibility", () => {
  it("publishes the 21st wallet event of the day but stops counting at the cap (20)", async () => {
    const chain = makeChain();
    // 21 identical stakes from one wallet — same built calldata, so a single
    // recordBuild gives every tx a tier-1 fingerprint hit.
    const built = buildStakeTx({
      tokenAddress: TOKEN,
      amount: "100",
      agentId: "alice-bot",
    });
    await recordBuild({
      tool: "build_stake_transaction",
      agentId: "alice-bot",
      to: built.tx.to,
      data: built.tx.data,
    });
    const userData = decodeFunctionData({ abi: SEND_ABI, data: built.tx.data })
      .args[2] as Hex;
    for (let i = 1; i <= 21; i++) {
      addStakeTx(chain, {
        txHash: txHashOf(100 + i),
        block: 1000n,
        amountWei: parseEther("100"),
        userData,
        input: built.tx.data,
        deposit: true,
      });
    }

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(21); // feed still shows everything
    expect(report.counterBumps).toBe(20); // counters stop at the cap
    expect((await getVerifiedCounters(DATE)).byKind.stake).toBe(20);
  });

  it("publishes a floor-ui copy-trade with its source label but never counts it (plan AE8)", async () => {
    const chain = makeChain();
    // A human copy-trade: built through the real builder with the floor-ui
    // source byte and recorded — tier 1, above the buy floor.
    const built = await buildBuyTx({
      tokenAddress: TOKEN,
      ethAmount: "0.01",
      quotedAmountOut: parseEther("1000"),
      source: "floor-ui",
    });
    await recordBuild({
      tool: "build_buy_transaction",
      to: built.tx.to,
      data: built.tx.data,
    });
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ZAP_CONTRACT_ADDRESS,
      input: built.tx.data,
      valueWei: 10n ** 16n, // would count if agent-sourced
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));

    expect(report.published).toBe(1);
    expect(report.counterBumps).toBe(0);

    const events = await getRecentEvents(10);
    expect(events[0]).toMatchObject({
      kind: "buy",
      tier: 1,
      source: "floor-ui",
    });

    const counters = await getVerifiedCounters(DATE);
    expect(counters.byKind.buy).toBe(0);
    expect(counters.volumeEth).toBe(0);
    expect(counters.activeWallets).toBe(0);
  });

  it("routes resident buys to the resident volume key, never the external one", async () => {
    process.env.RESIDENT_ADDRESS = WALLET;
    const chain = makeChain();
    const built = await buildBuy({ ethAmount: "0.05" });
    await recordBuild({
      tool: "build_buy_transaction",
      agentId: "alice-bot",
      to: built.tx.to,
      data: built.tx.data,
    });
    addBuyTx(chain, {
      txHash: TX1,
      block: 1000n,
      to: ZAP_CONTRACT_ADDRESS,
      input: built.tx.data,
      valueWei: 5n * 10n ** 16n,
    });

    const report = asReport(await runWatcher({ client: makeClient(chain) }));
    expect(report.counterBumps).toBe(1);

    const counters = await getVerifiedCounters(DATE);
    expect(counters.byKind.buy).toBe(1);
    expect(counters.residentVolumeEth).toBeCloseTo(0.05);
    expect(counters.volumeEth).toBe(0);
  });
});
