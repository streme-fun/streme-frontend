// Floor watcher — discovery, verification, publishing (plan U4).
//
// Each run scans a confirmed window of Base blocks for gateway-built
// transactions, anchored on event logs per action type plus a block scan
// for zap buys (the zap contracts emit no events):
//
//   stakes    ERC777 `Sent` logs with to = StakingHelper; success requires a
//             `Deposit` log in the same receipt (the helper's
//             TokenNotSupported refund branch emits none → "stake_refunded")
//   unstakes  `Withdraw` topic logs, emitter-validated via stakeableToken()
//   buys      block scan: tx.to == zap, plus watermark substring scan for
//             wrapped (4337/smart-wallet) calldata
//   streams   CFA `FlowUpdated` logs → watermark from tx.input
//   connects  block scan: tx.to == GDA forwarder + watermark in tx.input.
//             The PoolConnectionUpdated event is emitted by the GDA
//             *agreement* contract (not the forwarder we target), so v1
//             derives connects from calldata rather than risk anchoring on
//             a wrong address.
//
// Verification tiers per event: (1) fingerprint(tx.to, tx.input) hit,
// (2) watermark nonce → telemetry record, (3) valid watermark only.
// No watermark and no fingerprint → not a floor event. Counters bump only
// for tier 1/2. One event per txHash (zap buy wins over its interior
// Deposit; stake wins over its interior transfer).

import {
  decodeEventLog,
  decodeFunctionData,
  encodeEventTopics,
  formatEther,
  parseAbi,
  parseAbiItem,
  toFunctionSelector,
  type Abi,
  type AbiEvent,
  type Hex,
} from "viem";
import { STAKING_HELPER } from "@/src/lib/agent/txBuilders";
import {
  decodeWatermark,
  findWatermark,
  fingerprint,
  type DecodedWatermark,
} from "@/src/lib/agent/watermark";
import { ZAP_CONTRACT_ADDRESS } from "@/src/lib/contracts";
import { publicClient } from "@/src/lib/viemClient";
import {
  acquireLock,
  bumpVerifiedCounters,
  floorDateKey,
  getCursor,
  getFingerprint,
  getNonceIndex,
  incrWalletDailyEvents,
  markSeen,
  publishEvents,
  releaseLock,
  setCursor,
  wasSeen,
  type CountableKind,
  type FloorEvent,
  type FloorEventKind,
} from "./store";

type Address = `0x${string}`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Publish only at head − 15 (~30s on Base) — kills shallow-reorg risk. */
const CONFIRMATION_DEPTH = 15n;
/** First run backfills at most this many blocks. */
const BACKFILL_BLOCKS = 300n;
/** Max blocks per getLogs/scan range. */
const CHUNK_BLOCKS = 150n;
const LOCK_NAME = "watcher";
const LOCK_TTL_SECONDS = 120;

/** Value floors for counter eligibility (events below still publish). */
const BUY_FLOOR_WEI = 10n ** 15n; // 0.001 ETH
const STAKE_FLOOR_WEI = 10n ** 15n; // 1e15 wei
/** Per-wallet daily event cap for counter eligibility. */
const WALLET_DAILY_EVENT_CAP = 20;

/** CFA agreement contract on Base — emits FlowUpdated. */
const CFA_AGREEMENT: Address = "0x19ba78b9cdb05a877718841c574325fdb53601bb";
/** GDA v1 forwarder on Base — connect-pool txs target it. */
const GDA_FORWARDER: Address = "0x6da13bde224a05a288748d857b9e7ddeffd1de08";

const ZAP_ADDRESS = ZAP_CONTRACT_ADDRESS.toLowerCase();
const HELPER_ADDRESS = STAKING_HELPER.toLowerCase();

const SENT_EVENT = parseAbiItem(
  "event Sent(address indexed operator, address indexed from, address indexed to, uint256 amount, bytes data, bytes operatorData)"
) as AbiEvent;

const STAKED_TOKEN_ABI = parseAbi([
  "event Deposit(address indexed account, uint256 depositTimestamp, uint256 amount)",
  "event Withdraw(address indexed account, uint256 depositTimestamp, uint256 amount)",
]);
const WITHDRAW_EVENT = STAKED_TOKEN_ABI.find(
  (item) => item.type === "event" && item.name === "Withdraw"
) as AbiEvent;
const DEPOSIT_TOPIC = encodeEventTopics({
  abi: STAKED_TOKEN_ABI,
  eventName: "Deposit",
})[0];

const FLOW_UPDATED_EVENT = parseAbiItem(
  "event FlowUpdated(address indexed token, address indexed sender, address indexed receiver, int96 flowRate, int256 totalSenderFlowRate, int256 totalReceiverFlowRate, bytes userData)"
) as AbiEvent;

const STAKEABLE_TOKEN_ABI = parseAbi([
  "function stakeableToken() view returns (address)",
]);

const ZAP_ABI = parseAbi([
  "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) payable returns (uint256)",
  "function zapETHx(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) payable returns (uint256)",
]);
const ZAP_SELECTORS = [
  toFunctionSelector(
    "function zap(address,uint256,uint256,address)"
  ).toLowerCase(),
  toFunctionSelector(
    "function zapETHx(address,uint256,uint256,address)"
  ).toLowerCase(),
];

const CONNECT_POOL_ABI = parseAbi([
  "function connectPool(address pool, bytes userData) returns (bool)",
]);

// ---------------------------------------------------------------------------
// Injectable client (publicClient-compatible; narrow so tests can fake it)
// ---------------------------------------------------------------------------

export interface WatcherLog {
  address: Address;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex?: number;
  /** Decoded args (viem getLogs with an explicit `event`) */
  args: Record<string, unknown>;
}

export interface WatcherTx {
  hash: Hex;
  from: Address;
  to: Address | null;
  input: Hex;
  value: bigint;
}

export interface WatcherReceiptLog {
  address: Address;
  topics: Hex[];
  data: Hex;
}

export interface WatcherClient {
  getBlockNumber(): Promise<bigint>;
  getLogs(args: {
    address?: Address;
    event: AbiEvent;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<WatcherLog[]>;
  getBlock(args: {
    blockNumber: bigint;
    includeTransactions: true;
  }): Promise<{ timestamp: bigint; transactions: WatcherTx[] }>;
  getTransaction(args: { hash: Hex }): Promise<WatcherTx>;
  getTransactionReceipt(args: {
    hash: Hex;
  }): Promise<{ logs: WatcherReceiptLog[] }>;
  readContract(args: {
    address: Address;
    abi: Abi;
    functionName: string;
  }): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Run report
// ---------------------------------------------------------------------------

export interface WatcherRunReport {
  skipped?: undefined;
  dryRun: boolean;
  processedFrom: string | null;
  processedTo: string | null;
  discovered: number;
  published: number;
  skippedCandidates: number;
  counterBumps: number;
  errors: string[];
}

export type WatcherResult = WatcherRunReport | { skipped: "locked" };

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Candidate {
  txHash: string;
  blockNumber: bigint;
  kind: FloorEventKind;
  wallet: string;
  token?: string;
  /** Token amount in wei (stake/unstake) */
  amountWei?: bigint;
  /** ETH value in wei (buys) */
  valueWei?: bigint;
  watermark: DecodedWatermark | null;
  txTo: string | null;
  txInput: Hex | null;
  staked?: boolean;
  /** Stream flow rate (0 = closed) */
  flowRate?: bigint;
}

/** Reconciliation priority — the outermost action wins per txHash. */
const KIND_PRIORITY: Record<FloorEventKind, number> = {
  buy: 6,
  stake: 5,
  stake_refunded: 5,
  unstake: 4,
  stream: 3,
  connect: 2,
};

function short(address?: string): string {
  if (!address) return "a token";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function isAddressLike(value: unknown): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/**
 * Per-run emitter validation cache: only contracts exposing a plausible
 * stakeableToken() are real StakedToken instances — anyone can emit a
 * Withdraw/Deposit-shaped log.
 */
async function validStakedTokenEmitter(
  client: WatcherClient,
  emitter: Address,
  cache: Map<string, string | null>
): Promise<string | null> {
  const key = emitter.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  let token: string | null = null;
  try {
    const result = await client.readContract({
      address: emitter,
      abi: STAKEABLE_TOKEN_ABI as Abi,
      functionName: "stakeableToken",
    });
    if (isAddressLike(result)) token = (result as string).toLowerCase();
  } catch {
    token = null;
  }
  cache.set(key, token);
  return token;
}

/** True when the receipt holds a real (non-dust, emitter-validated) Deposit. */
async function receiptHasValidDeposit(
  client: WatcherClient,
  receipt: { logs: WatcherReceiptLog[] },
  emitterCache: Map<string, string | null>
): Promise<boolean> {
  for (const log of receipt.logs) {
    if (!log.topics?.length || log.topics[0] !== DEPOSIT_TOPIC) continue;
    let amount: bigint;
    try {
      const decoded = decodeEventLog({
        abi: STAKED_TOKEN_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
        eventName: "Deposit",
      });
      amount = (decoded.args as { amount: bigint }).amount;
    } catch {
      continue;
    }
    // StremeAutoStaker emits 1-wei Deposit dust — never a real stake.
    if (amount <= 1n) continue;
    if (await validStakedTokenEmitter(client, log.address, emitterCache)) {
      return true;
    }
  }
  return false;
}

/** Rough tool↔kind cross-check for tier-2 (nonce-joined) records. */
function toolRoughlyMatches(tool: string, kind: FloorEventKind): boolean {
  switch (kind) {
    case "buy":
      return tool.includes("buy");
    case "stake":
    case "stake_refunded":
      // Buy-with-auto-stake interiors reconcile to "buy", so a stake event
      // should come from the stake tool — not the unstake one.
      return tool.includes("stake") && !tool.includes("unstake");
    case "unstake":
      return tool.includes("unstake");
    case "stream":
      return tool.includes("stream");
    case "connect":
      return tool.includes("connect");
  }
}

interface TierResolution {
  tier: 1 | 2 | 3;
  agentId: string | null;
}

/**
 * Verification tiers: fingerprint(tx.to, tx.input) hit → 1; watermark nonce
 * resolving through the nonce index to a plausible record → 2; valid
 * watermark only → 3; neither → null (not a floor event).
 */
async function resolveTier(candidate: Candidate): Promise<TierResolution | null> {
  if (candidate.txTo && candidate.txInput) {
    const fp = fingerprint(candidate.txTo, candidate.txInput);
    const record = await getFingerprint(fp);
    if (record) return { tier: 1, agentId: record.agentId };
  }
  if (candidate.watermark) {
    const fp = await getNonceIndex(candidate.watermark.nonce);
    if (fp) {
      const record = await getFingerprint(fp);
      if (record && toolRoughlyMatches(record.tool, candidate.kind)) {
        return { tier: 2, agentId: record.agentId };
      }
    }
    return { tier: 3, agentId: null };
  }
  return null;
}

function describe(candidate: Candidate): string {
  const token = short(candidate.token);
  switch (candidate.kind) {
    case "buy": {
      const eth =
        candidate.valueWei !== undefined
          ? `${formatEther(candidate.valueWei)} ETH of `
          : "";
      return `bought ${eth}${token}${candidate.staked ? " and staked it" : ""}`;
    }
    case "stake":
      return `staked ${formatEther(candidate.amountWei ?? 0n)} ${token}`;
    case "stake_refunded":
      return `stake of ${formatEther(candidate.amountWei ?? 0n)} ${token} was refunded (token not stakeable)`;
    case "unstake":
      return `unstaked ${formatEther(candidate.amountWei ?? 0n)} ${token}`;
    case "stream":
      return candidate.flowRate === 0n
        ? `closed a ${token} stream`
        : `opened or updated a ${token} stream`;
    case "connect":
      return `connected to reward pool ${token}`;
  }
}

function belowValueFloor(candidate: Candidate): boolean {
  if (candidate.kind === "buy") {
    return (candidate.valueWei ?? 0n) < BUY_FLOOR_WEI;
  }
  if (candidate.kind === "stake") {
    return (candidate.amountWei ?? 0n) < STAKE_FLOOR_WEI;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Per-chunk discovery
// ---------------------------------------------------------------------------

interface ChunkContext {
  client: WatcherClient;
  emitterCache: Map<string, string | null>;
  txCache: Map<string, WatcherTx>;
  blockTimestamps: Map<string, number>;
}

async function getTx(ctx: ChunkContext, hash: Hex): Promise<WatcherTx> {
  const cached = ctx.txCache.get(hash.toLowerCase());
  if (cached) return cached;
  const tx = await ctx.client.getTransaction({ hash });
  ctx.txCache.set(hash.toLowerCase(), tx);
  return tx;
}

/** Block scan: zap buys (fast path + wrapped-calldata watermark) + connects. */
async function scanBlocks(
  ctx: ChunkContext,
  from: bigint,
  to: bigint
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (let n = from; n <= to; n++) {
    const block = await ctx.client.getBlock({
      blockNumber: n,
      includeTransactions: true,
    });
    ctx.blockTimestamps.set(n.toString(), Number(block.timestamp) * 1000);

    for (const tx of block.transactions) {
      const to = tx.to?.toLowerCase() ?? null;
      const input = (tx.input ?? "0x").toLowerCase() as Hex;
      ctx.txCache.set(tx.hash.toLowerCase(), tx);

      const isZapTarget = to === ZAP_ADDRESS;
      const watermark = findWatermark(input);
      if (!isZapTarget && !watermark) continue;

      if (isZapTarget || ZAP_SELECTORS.some((sel) => input.includes(sel.slice(2)))) {
        // Buy — direct zap call, or wrapped calldata whose embedded call
        // targets the zap (selector appears before the watermark suffix).
        let token: string | undefined;
        if (isZapTarget) {
          try {
            const decoded = decodeFunctionData({ abi: ZAP_ABI, data: input });
            token = (decoded.args[0] as string).toLowerCase();
          } catch {
            token = undefined;
          }
        }
        const receipt = await ctx.client.getTransactionReceipt({
          hash: tx.hash,
        });
        const staked = await receiptHasValidDeposit(
          ctx.client,
          receipt,
          ctx.emitterCache
        );
        candidates.push({
          txHash: tx.hash.toLowerCase(),
          blockNumber: n,
          kind: "buy",
          wallet: tx.from.toLowerCase(),
          token,
          valueWei: tx.value,
          watermark,
          txTo: to,
          txInput: input,
          staked,
        });
        continue;
      }

      if (to === GDA_FORWARDER) {
        // Connect — derived from calldata (see header note on why we don't
        // anchor on PoolConnectionUpdated in v1).
        let pool: string | undefined;
        try {
          const decoded = decodeFunctionData({
            abi: CONNECT_POOL_ABI,
            data: input,
          });
          pool = (decoded.args[0] as string).toLowerCase();
        } catch {
          pool = undefined;
        }
        candidates.push({
          txHash: tx.hash.toLowerCase(),
          blockNumber: n,
          kind: "connect",
          wallet: tx.from.toLowerCase(),
          token: pool,
          watermark,
          txTo: to,
          txInput: input,
        });
        continue;
      }

      // Watermarked but neither zap-targeted nor a GDA connect: stake,
      // unstake, and stream are log-anchored (their events fire even under
      // calldata wrapping), so the scan skips them rather than double-count.
    }
  }
  return candidates;
}

/** Stakes: ERC777 Sent to the StakingHelper; Deposit receipt check. */
async function discoverStakes(
  ctx: ChunkContext,
  from: bigint,
  to: bigint
): Promise<Candidate[]> {
  const logs = await ctx.client.getLogs({
    event: SENT_EVENT,
    args: { to: STAKING_HELPER },
    fromBlock: from,
    toBlock: to,
  });
  const candidates: Candidate[] = [];
  for (const log of logs) {
    const args = log.args as {
      from: Address;
      to: Address;
      amount: bigint;
      data: Hex;
    };
    if ((args.to ?? "").toLowerCase() !== HELPER_ADDRESS) continue;
    // 1-wei dust (StremeAutoStaker) — filtered entirely.
    if (args.amount <= 1n) continue;

    // The Sent `data` field IS the userData → exact decode, not substring.
    const watermark = decodeWatermark((args.data ?? "0x") as Hex);
    const tx = await getTx(ctx, log.transactionHash);
    const receipt = await ctx.client.getTransactionReceipt({
      hash: log.transactionHash,
    });
    const deposited = await receiptHasValidDeposit(
      ctx.client,
      receipt,
      ctx.emitterCache
    );
    candidates.push({
      txHash: log.transactionHash.toLowerCase(),
      blockNumber: log.blockNumber,
      kind: deposited ? "stake" : "stake_refunded",
      wallet: args.from.toLowerCase(),
      token: log.address.toLowerCase(),
      amountWei: args.amount,
      watermark,
      txTo: tx.to?.toLowerCase() ?? null,
      txInput: tx.input,
    });
  }
  return candidates;
}

/** Unstakes: Withdraw topic logs (no address filter), emitter-validated. */
async function discoverUnstakes(
  ctx: ChunkContext,
  from: bigint,
  to: bigint
): Promise<Candidate[]> {
  const logs = await ctx.client.getLogs({
    event: WITHDRAW_EVENT,
    fromBlock: from,
    toBlock: to,
  });
  const candidates: Candidate[] = [];
  for (const log of logs) {
    const stakeableToken = await validStakedTokenEmitter(
      ctx.client,
      log.address,
      ctx.emitterCache
    );
    if (!stakeableToken) continue; // not a real StakedToken — drop

    const args = log.args as { account: Address; amount: bigint };
    const tx = await getTx(ctx, log.transactionHash);
    candidates.push({
      txHash: log.transactionHash.toLowerCase(),
      blockNumber: log.blockNumber,
      kind: "unstake",
      wallet: args.account.toLowerCase(),
      token: stakeableToken,
      amountWei: args.amount,
      watermark: findWatermark(tx.input),
      txTo: tx.to?.toLowerCase() ?? null,
      txInput: tx.input,
    });
  }
  return candidates;
}

/** Streams: FlowUpdated on the CFA agreement → watermark from tx.input. */
async function discoverStreams(
  ctx: ChunkContext,
  from: bigint,
  to: bigint
): Promise<Candidate[]> {
  const logs = await ctx.client.getLogs({
    address: CFA_AGREEMENT,
    event: FLOW_UPDATED_EVENT,
    fromBlock: from,
    toBlock: to,
  });
  const candidates: Candidate[] = [];
  for (const log of logs) {
    const args = log.args as {
      token: Address;
      sender: Address;
      flowRate: bigint;
    };
    const tx = await getTx(ctx, log.transactionHash);
    candidates.push({
      txHash: log.transactionHash.toLowerCase(),
      blockNumber: log.blockNumber,
      kind: "stream",
      wallet: args.sender.toLowerCase(),
      token: args.token.toLowerCase(),
      flowRate: args.flowRate,
      watermark: findWatermark(tx.input),
      txTo: tx.to?.toLowerCase() ?? null,
      txInput: tx.input,
    });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export async function runWatcher(
  options: {
    client?: WatcherClient;
    now?: number;
    dryRun?: boolean;
    budgetMs?: number;
  } = {}
): Promise<WatcherResult> {
  const client =
    options.client ?? (publicClient as unknown as WatcherClient);
  const startedAt = options.now ?? Date.now();
  const dryRun = options.dryRun ?? false;
  const budgetMs = options.budgetMs ?? 40_000;

  if (!(await acquireLock(LOCK_NAME, LOCK_TTL_SECONDS))) {
    return { skipped: "locked" };
  }

  const report: WatcherRunReport = {
    dryRun,
    processedFrom: null,
    processedTo: null,
    discovered: 0,
    published: 0,
    skippedCandidates: 0,
    counterBumps: 0,
    errors: [],
  };

  try {
    const head = await client.getBlockNumber();
    const to = head - CONFIRMATION_DEPTH;
    const cursor = await getCursor();
    const from =
      cursor !== null ? BigInt(cursor) + 1n : to - BACKFILL_BLOCKS;
    if (from > to) return report; // nothing confirmed since last run

    report.processedFrom = from.toString();
    const residentAddress = process.env.RESIDENT_ADDRESS?.toLowerCase();

    for (let chunkStart = from; chunkStart <= to; chunkStart += CHUNK_BLOCKS) {
      // Budget check between chunks (always process at least one) — cursor
      // is persisted per completed chunk, so a stop here loses nothing.
      if (
        chunkStart > from &&
        Date.now() - startedAt >= budgetMs
      ) {
        break;
      }
      const chunkEnd =
        chunkStart + CHUNK_BLOCKS - 1n > to ? to : chunkStart + CHUNK_BLOCKS - 1n;

      const ctx: ChunkContext = {
        client,
        emitterCache: new Map(),
        txCache: new Map(),
        blockTimestamps: new Map(),
      };

      try {
        const candidates = [
          ...(await scanBlocks(ctx, chunkStart, chunkEnd)),
          ...(await discoverStakes(ctx, chunkStart, chunkEnd)),
          ...(await discoverUnstakes(ctx, chunkStart, chunkEnd)),
          ...(await discoverStreams(ctx, chunkStart, chunkEnd)),
        ];
        report.discovered += candidates.length;

        // Per-txHash reconciliation: ONE event per tx, typed by the
        // outermost action (buy beats its interior stake, etc.).
        const byTx = new Map<string, Candidate>();
        for (const candidate of candidates) {
          const existing = byTx.get(candidate.txHash);
          if (
            !existing ||
            KIND_PRIORITY[candidate.kind] > KIND_PRIORITY[existing.kind]
          ) {
            byTx.set(candidate.txHash, candidate);
          }
        }
        report.skippedCandidates += candidates.length - byTx.size;

        const toPublish: FloorEvent[] = [];
        for (const candidate of byTx.values()) {
          if (await wasSeen(candidate.txHash)) {
            report.skippedCandidates++;
            continue;
          }
          const resolution = await resolveTier(candidate);
          if (!resolution) {
            // No watermark and no fingerprint — not a floor event.
            report.skippedCandidates++;
            continue;
          }

          const at =
            ctx.blockTimestamps.get(candidate.blockNumber.toString()) ??
            startedAt;
          const belowFloor = belowValueFloor(candidate);
          const event: FloorEvent = {
            txHash: candidate.txHash,
            block: candidate.blockNumber.toString(),
            at,
            kind: candidate.kind,
            wallet: candidate.wallet,
            token: candidate.token,
            amountEth:
              candidate.valueWei !== undefined
                ? formatEther(candidate.valueWei)
                : undefined,
            amountToken:
              candidate.amountWei !== undefined
                ? formatEther(candidate.amountWei)
                : undefined,
            tier: resolution.tier,
            agentId: resolution.tier <= 2 ? resolution.agentId : null,
            source:
              candidate.watermark?.source === "floor-ui"
                ? "floor-ui"
                : "agent",
            staked: candidate.staked,
            belowFloor: belowFloor || undefined,
            description: describe(candidate),
          };
          toPublish.push(event);

          // Counters: tier 1/2 only, countable kinds only, above the value
          // floor, and within the per-wallet daily cap.
          const countable =
            resolution.tier <= 2 &&
            candidate.kind !== "stake_refunded" &&
            !belowFloor;
          if (countable) {
            const date = floorDateKey(at);
            const walletEvents = dryRun
              ? 1
              : await incrWalletDailyEvents(candidate.wallet, date);
            if (walletEvents <= WALLET_DAILY_EVENT_CAP) {
              const isResident =
                !!residentAddress && candidate.wallet === residentAddress;
              if (!dryRun) {
                await bumpVerifiedCounters({
                  kind: candidate.kind as CountableKind,
                  wallet: candidate.wallet,
                  volumeEth:
                    candidate.kind === "buy" &&
                    candidate.valueWei !== undefined
                      ? Number(formatEther(candidate.valueWei))
                      : undefined,
                  isResident,
                  date,
                });
              }
              report.counterBumps++;
            }
          }

          if (!dryRun) await markSeen(candidate.txHash);
        }

        if (!dryRun && toPublish.length > 0) await publishEvents(toPublish);
        report.published += toPublish.length;
      } catch (error) {
        // Never advance the cursor past a failed range — stop here; the
        // next run reprocesses from the last fully-processed chunk.
        report.errors.push(
          `chunk ${chunkStart}-${chunkEnd}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        break;
      }

      report.processedTo = chunkEnd.toString();
      if (!dryRun) await setCursor(chunkEnd.toString());
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await releaseLock(LOCK_NAME);
  }

  return report;
}
