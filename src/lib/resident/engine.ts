// The Resident engine — run orchestration, code-level guardrails, and the
// journal state machine (plan U7). This is the only module allowed to
// import the signer (src/lib/resident/wallet.ts — enforced by
// check:resident-isolation).
//
// FAILS CLOSED (plan R22): live signing requires RESIDENT_ENABLED === "true"
// + a well-formed RESIDENT_PRIVATE_KEY + ANTHROPIC_API_KEY + a real Redis
// round-trip (the in-memory fallback never counts). Anything missing forces
// dry-run: decisions are still made and journaled (marked dryRun), but
// nothing is signed or broadcast and no spend is recorded.
//
// Hard guardrails live HERE, never in the prompt: action allowlist
// (buy/stake/connect), one action per run, per-tx and per-day ETH caps,
// blacklist + market-cap floor via the public gateway's getToken, pinned
// slippage. The LLM only proposes.
//
// The Resident uses ONLY the public gateway functions (getPulse, getYield,
// getToken, build*ForToken) — no privileged data paths.
//
// Env surface (documented here per plan "Documentation / Operational
// Notes" — new vars appended to the plan's list):
//   RESIDENT_ENABLED          "true" to allow live signing
//   RESIDENT_PRIVATE_KEY      the hot wallet key (deployment secret)
//   RESIDENT_ADDRESS          watcher-side resident identification (U4)
//   RESIDENT_MAX_ETH_PER_TX   per-action ETH cap (default "0.01")
//   RESIDENT_MAX_ETH_PER_DAY  daily ETH cap (default "0.05")
//   RESIDENT_AI_MODEL         decision model override (decide.ts)
//   FLOOR_ADMIN_SECRET        bearer for the halt/resume admin endpoint
//   ANTHROPIC_API_KEY         decision LLM (shared with pulse)
//   CRON_SECRET               cron auth (shared)

import { parseEther, type Hex } from "viem";
import {
  buildBuyTxForToken,
  buildConnectPoolTxForToken,
  buildStakeTxForToken,
  getPulse,
  getToken,
  getYield,
  type AgentToken,
} from "@/src/lib/agent/actions";
import {
  acquireLock,
  addResidentSpend,
  floorDateKey,
  getResidentHalt,
  getResidentSpend,
  isRedisLive,
  releaseLock,
  setResidentHalt,
} from "@/src/lib/floor/store";
import { publicClient } from "@/src/lib/viemClient";
import {
  decide,
  residentAiEnabled,
  type ResidentDecision,
  type ResidentSignals,
} from "./decide";
import {
  getJournal,
  journalAppend,
  journalUpdateState,
  newJournalId,
  type ResidentJournalAction,
  type ResidentJournalEntry,
} from "./journal";
import { getResidentAddress, getResidentWalletClient } from "./wallet";

type Address = `0x${string}`;

// ---------------------------------------------------------------------------
// Guardrail constants — code, not prompt
// ---------------------------------------------------------------------------

/** The house identity. Reserved in sanitizeAgentId; only this engine may
 * stamp it (via the internal-only watermark escape hatch). Display identity
 * remains the wallet address per plan R21. */
export const RESIDENT_AGENT_ID = "streme-resident";

/** Slippage is pinned in code — never read from the LLM proposal. */
export const PINNED_SLIPPAGE_BPS = 100;
const DEFAULT_MAX_ETH_PER_TX = 0.01;
const DEFAULT_MAX_ETH_PER_DAY = 0.05;
/** Liquidity floor: gateway marketCapUsd (token.marketData.marketCap
 * upstream) must clear this. */
export const MIN_TOKEN_MARKET_CAP_USD = 10_000;

const LOCK_NAME = "resident";
const LOCK_TTL_SECONDS = 300;
/** Receipt wait. Kept under the route's maxDuration=60 so a slow inclusion
 * degrades to next-run reconciliation instead of a killed invocation. */
const RECEIPT_TIMEOUT_MS = 45_000;
/** A `broadcast` entry with no receipt after this long reconciles to failed. */
const BROADCAST_STALE_MS = 60 * 60 * 1000;
/** Journal window scanned for non-terminal entries at run start. */
const RECONCILE_SCAN_LIMIT = 200;

function maxEthPerTx(): number {
  const parsed = parseFloat(process.env.RESIDENT_MAX_ETH_PER_TX ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ETH_PER_TX;
}

function maxEthPerDay(): number {
  const parsed = parseFloat(process.env.RESIDENT_MAX_ETH_PER_DAY ?? "");
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_ETH_PER_DAY;
}

// ---------------------------------------------------------------------------
// Injectable chain client (narrow, like the watcher's WatcherClient)
// ---------------------------------------------------------------------------

export interface ResidentClient {
  getTransactionCount(args: {
    address: Address;
    blockTag: "pending" | "latest";
  }): Promise<number>;
  /** null = receipt not found (pending/dropped) — NOT an RPC failure */
  getTransactionReceipt(args: {
    hash: Hex;
  }): Promise<{ status: "success" | "reverted" } | null>;
  getBalance(args: { address: Address }): Promise<bigint>;
  /** eth_call simulation; throws on revert */
  call(args: {
    to: Address;
    data: Hex;
    value?: bigint;
    account: Address;
  }): Promise<unknown>;
  sendTransaction(args: {
    to: Address;
    data: Hex;
    value?: bigint;
  }): Promise<Hex>;
  /** Throws on timeout */
  waitForTransactionReceipt(args: {
    hash: Hex;
    timeoutMs: number;
  }): Promise<{ status: "success" | "reverted" }>;
}

/** Production client: reads via the shared publicClient, writes via the
 * Resident wallet (constructed lazily — only on an actual broadcast). */
function defaultClient(): ResidentClient {
  return {
    getTransactionCount: (args) =>
      publicClient.getTransactionCount({
        address: args.address,
        blockTag: args.blockTag,
      }),
    async getTransactionReceipt(args) {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: args.hash,
        });
        return { status: receipt.status };
      } catch (error) {
        // viem throws TransactionReceiptNotFoundError for unmined hashes;
        // treat only that as "not found" and let real RPC failures surface.
        if ((error as { name?: string })?.name === "TransactionReceiptNotFoundError") {
          return null;
        }
        throw error;
      }
    },
    getBalance: (args) => publicClient.getBalance(args),
    call: (args) =>
      publicClient.call({
        to: args.to,
        data: args.data,
        value: args.value,
        account: args.account,
      }),
    async sendTransaction(args) {
      const wallet = getResidentWalletClient();
      return wallet.sendTransaction({
        account: wallet.account!,
        chain: wallet.chain,
        to: args.to,
        data: args.data,
        value: args.value,
      });
    },
    waitForTransactionReceipt: async (args) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: args.hash,
        timeout: args.timeoutMs,
      });
      return { status: receipt.status };
    },
  };
}

// ---------------------------------------------------------------------------
// Run report
// ---------------------------------------------------------------------------

export interface ResidentRunReport {
  skipped?: "halted" | "locked";
  dryRun: boolean;
  /** Which fail-closed gates are missing (empty = live-capable) */
  gated: string[];
  decision: ResidentDecision | null;
  /** Journal entry ids written or updated this run */
  journaled: string[];
  /** Non-terminal entries reconciled against the chain */
  reconciled: number;
  halted: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Guardrails
// ---------------------------------------------------------------------------

interface ApprovedAction {
  journalAction: ResidentJournalAction;
  token: AgentToken;
  /** ETH committed by this action (buys), for the spend ledger */
  spendEth: number;
}

type GuardrailVerdict =
  | { ok: true; approved: ApprovedAction }
  | { ok: false; reason: string };

/**
 * Code guardrails, applied to every proposal REGARDLESS of LLM output:
 * allowlist, token blacklist + liquidity floor (via the public gateway),
 * per-tx clamp, daily spend cap, balance check. One action per run is
 * structural (a single decision, a single act step).
 */
async function applyGuardrails(
  decision: ResidentDecision,
  ethBalanceWei: bigint | null,
  today: string
): Promise<GuardrailVerdict> {
  if (!["buy", "stake", "connect"].includes(decision.action)) {
    return {
      ok: false,
      reason: `Action "${decision.action}" is not on the allowlist (buy, stake, connect)`,
    };
  }
  if (!decision.tokenAddress) {
    return { ok: false, reason: "Proposal has no tokenAddress" };
  }

  // Blacklist + existence via the public gateway (R18 enforcement included).
  let token: AgentToken;
  try {
    token = await getToken(decision.tokenAddress);
  } catch (error) {
    return {
      ok: false,
      reason: `Token rejected by gateway lookup: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  // Liquidity floor — gateway marketCapUsd (upstream marketData.marketCap).
  if (!(token.marketCapUsd > MIN_TOKEN_MARKET_CAP_USD)) {
    return {
      ok: false,
      reason: `Token market cap $${token.marketCapUsd} is below the $${MIN_TOKEN_MARKET_CAP_USD} floor`,
    };
  }

  if (decision.action === "buy") {
    const proposed = parseFloat(decision.ethAmount ?? "");
    if (!Number.isFinite(proposed) || proposed <= 0) {
      return { ok: false, reason: "Buy proposal has no valid ethAmount" };
    }
    // Clamp (not reject) to the per-tx cap.
    const clamped = Math.min(proposed, maxEthPerTx());
    const ethAmount = clamped.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");

    const spent = await getResidentSpend(today);
    if (spent + clamped > maxEthPerDay()) {
      return {
        ok: false,
        reason: `Daily spend cap reached: ${spent} ETH spent + ${clamped} ETH proposed > ${maxEthPerDay()} ETH/day`,
      };
    }
    if (ethBalanceWei !== null && parseEther(ethAmount) > ethBalanceWei) {
      return {
        ok: false,
        reason: `Insufficient ETH balance for a ${ethAmount} ETH buy`,
      };
    }
    return {
      ok: true,
      approved: {
        journalAction: { kind: "buy", token: token.address, ethAmount },
        token,
        spendEth: clamped,
      },
    };
  }

  if (decision.action === "stake") {
    try {
      if (parseEther(decision.amount ?? "") <= 0n) throw new Error("zero");
    } catch {
      return { ok: false, reason: "Stake proposal has no valid amount" };
    }
    return {
      ok: true,
      approved: {
        journalAction: {
          kind: "stake",
          token: token.address,
          amount: decision.amount,
        },
        token,
        spendEth: 0,
      },
    };
  }

  // connect
  return {
    ok: true,
    approved: {
      journalAction: { kind: "connect", token: token.address },
      token,
      spendEth: 0,
    },
  };
}

/** Build the unsigned tx for an approved action via the PUBLIC gateway
 * builders, stamped with the reserved house identity. Slippage is pinned. */
async function buildApproved(approved: ApprovedAction) {
  const { journalAction } = approved;
  const identity = {
    internalAgentId: RESIDENT_AGENT_ID,
    source: "agent" as const,
  };
  switch (journalAction.kind) {
    case "buy":
      return buildBuyTxForToken({
        tokenAddress: journalAction.token,
        ethAmount: journalAction.ethAmount!,
        stake: false,
        slippageBps: PINNED_SLIPPAGE_BPS,
        ...identity,
      });
    case "stake":
      return buildStakeTxForToken({
        tokenAddress: journalAction.token,
        amount: journalAction.amount!,
        ...identity,
      });
    case "connect":
      return buildConnectPoolTxForToken({
        tokenAddress: journalAction.token,
        ...identity,
      });
  }
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

function summarizeEntry(entry: ResidentJournalEntry): string {
  const action = entry.action
    ? ` ${entry.action.kind} ${entry.action.token}${
        entry.action.ethAmount ? ` ${entry.action.ethAmount} ETH` : ""
      }`
    : "";
  const when = new Date(entry.at).toISOString().slice(0, 16);
  return `${when} [${entry.state}${entry.dryRun ? ", dry-run" : ""}]${action} — ${entry.reasoning.slice(0, 160)}`;
}

async function gatherSignals(
  client: ResidentClient,
  address: Address | null,
  errors: string[]
): Promise<ResidentSignals> {
  let pulse: ResidentSignals["pulse"] = null;
  try {
    pulse = await getPulse();
  } catch (error) {
    errors.push(
      `getPulse failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let residentYield: ResidentSignals["residentYield"] = null;
  let ethBalanceWei: bigint | null = null;
  if (address) {
    try {
      residentYield = await getYield(address);
    } catch (error) {
      errors.push(
        `getYield failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    try {
      ethBalanceWei = await client.getBalance({ address });
    } catch (error) {
      errors.push(
        `getBalance failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const recentJournal = (await getJournal(5)).map(summarizeEntry);
  return { pulse, residentYield, ethBalanceWei, recentJournal };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export async function runResident(
  options: { now?: number; dryRun?: boolean; client?: ResidentClient } = {}
): Promise<ResidentRunReport> {
  const now = options.now ?? Date.now();
  const today = floorDateKey(now);

  // 1) Gates — fail closed: anything missing forces dry-run.
  const gated: string[] = [];
  let address: Address | null = null;
  if (process.env.RESIDENT_ENABLED !== "true") gated.push("RESIDENT_ENABLED");
  if (!process.env.RESIDENT_PRIVATE_KEY) {
    gated.push("RESIDENT_PRIVATE_KEY");
  } else {
    try {
      address = getResidentAddress();
    } catch {
      gated.push("RESIDENT_PRIVATE_KEY (malformed)");
    }
  }
  if (!residentAiEnabled()) gated.push("ANTHROPIC_API_KEY");
  if (!(await isRedisLive())) gated.push("redis (no live round-trip)");
  const dryRun = Boolean(options.dryRun) || gated.length > 0;

  const report: ResidentRunReport = {
    dryRun,
    gated,
    decision: null,
    journaled: [],
    reconciled: 0,
    halted: false,
    errors: [],
  };

  // 2) Halt flag — journal nothing, do nothing.
  if (await getResidentHalt()) {
    return { ...report, skipped: "halted", halted: true };
  }

  // 3) Run lock.
  if (!(await acquireLock(LOCK_NAME, LOCK_TTL_SECONDS))) {
    return { ...report, skipped: "locked" };
  }

  try {
    const client = options.client ?? defaultClient();

    if (!dryRun && address) {
      // 4) Chain reconciliation of non-terminal journal entries.
      let haltAfterReconcile: string | null = null;
      for (const entry of await getJournal(RECONCILE_SCAN_LIMIT)) {
        if (entry.dryRun) continue; // dry-run intentions are never broadcast
        if (entry.state === "broadcast" && entry.txHash) {
          let receipt: { status: "success" | "reverted" } | null;
          try {
            receipt = await client.getTransactionReceipt({
              hash: entry.txHash as Hex,
            });
          } catch (error) {
            // RPC trouble is not chain truth — leave the entry for next run.
            report.errors.push(
              `reconcile ${entry.id}: receipt lookup failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            continue;
          }
          if (receipt?.status === "success") {
            await journalUpdateState(entry.id, "confirmed");
            report.journaled.push(entry.id);
            report.reconciled++;
          } else if (receipt?.status === "reverted") {
            await journalUpdateState(entry.id, "failed", {
              error: "Reverted on chain (found during reconciliation)",
            });
            report.journaled.push(entry.id);
            report.reconciled++;
            haltAfterReconcile = `broadcast ${entry.id} reverted on chain`;
          } else if (now - entry.at > BROADCAST_STALE_MS) {
            await journalUpdateState(entry.id, "failed", {
              error: "Broadcast over an hour ago with no receipt — presumed dropped",
            });
            report.journaled.push(entry.id);
            report.reconciled++;
            haltAfterReconcile = `broadcast ${entry.id} never confirmed`;
          }
        } else if (entry.state === "intended") {
          // Dangling intention: a crash between journal and broadcast.
          // Operator-visible, and worth a human look before resuming.
          await journalUpdateState(entry.id, "halted", {
            error:
              "Dangling intention — run crashed between journal write and broadcast",
          });
          report.journaled.push(entry.id);
          report.reconciled++;
          haltAfterReconcile = `dangling intention ${entry.id}`;
        }
      }
      if (haltAfterReconcile) {
        await setResidentHalt(true);
        report.halted = true;
        report.errors.push(`halted during reconciliation: ${haltAfterReconcile}`);
        return report;
      }

      // 5) Pending-nonce check — a stuck tx halts the Resident (no retries).
      const [pending, latest] = [
        await client.getTransactionCount({ address, blockTag: "pending" }),
        await client.getTransactionCount({ address, blockTag: "latest" }),
      ];
      if (pending > latest) {
        const entry = await journalAppend({
          id: newJournalId(),
          at: now,
          state: "halted",
          reasoning: `Stuck transaction detected (pending nonce ${pending} > latest ${latest}). Halting until an operator resolves it.`,
        });
        await setResidentHalt(true);
        report.halted = true;
        report.journaled.push(entry.id);
        return report;
      }
    }

    // 6) Signals — strictly via public gateway functions + a balance read.
    const signals = await gatherSignals(client, address, report.errors);

    // 7) The proposal.
    const decision = await decide(signals);
    report.decision = decision;

    // 8) Code guardrails — regardless of LLM output.
    if (decision.action === "none") {
      const entry = await journalAppend({
        id: newJournalId(),
        at: now,
        state: "skipped",
        reasoning: decision.reasoning,
        dryRun: dryRun || undefined,
      });
      report.journaled.push(entry.id);
      return report;
    }

    const verdict = await applyGuardrails(decision, signals.ethBalanceWei, today);
    if (!verdict.ok) {
      const entry = await journalAppend({
        id: newJournalId(),
        at: now,
        state: "skipped",
        reasoning: `Guardrail: ${verdict.reason}. Proposal reasoning: ${decision.reasoning}`,
        dryRun: dryRun || undefined,
      });
      report.journaled.push(entry.id);
      return report;
    }

    const { approved } = verdict;

    if (dryRun) {
      // Decision journaled, nothing signed, no spend recorded.
      const entry = await journalAppend({
        id: newJournalId(),
        at: now,
        state: "intended",
        action: approved.journalAction,
        reasoning: decision.reasoning,
        dryRun: true,
      });
      report.journaled.push(entry.id);
      return report;
    }

    // 9) Act. Journal `intended` FIRST — a failed write means no broadcast.
    let entry: ResidentJournalEntry;
    try {
      entry = await journalAppend({
        id: newJournalId(),
        at: now,
        state: "intended",
        action: approved.journalAction,
        reasoning: decision.reasoning,
      });
    } catch (error) {
      report.errors.push(
        `journal write failed — aborting before broadcast: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return report;
    }
    report.journaled.push(entry.id);

    // Spend counted pessimistically BEFORE broadcast.
    if (approved.spendEth > 0) await addResidentSpend(today, approved.spendEth);

    const refundSpend = async () => {
      if (approved.spendEth > 0) await addResidentSpend(today, -approved.spendEth);
    };

    let built: Awaited<ReturnType<typeof buildApproved>>;
    try {
      built = await buildApproved(approved);
    } catch (error) {
      // Build failures (quote revert, token state change) are guardrail-class:
      // nothing left the house. Refund, skip, no halt.
      await journalUpdateState(entry.id, "skipped", {
        error: `Build failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      await refundSpend();
      return report;
    }

    const to = built.tx.to as Address;
    const data = built.tx.data as Hex;
    const value = built.tx.value ? BigInt(built.tx.value) : undefined;

    // Pre-broadcast simulation — a predicted revert is guardrail-class, not
    // a halt (refund the pessimistic spend, mark skipped, carry on next run).
    try {
      await client.call({ to, data, value, account: address as Address });
    } catch (error) {
      await journalUpdateState(entry.id, "skipped", {
        error: `Simulation revert: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      await refundSpend();
      return report;
    }

    let txHash: Hex;
    try {
      txHash = await client.sendTransaction({ to, data, value });
    } catch (error) {
      // Ambiguous: the tx may or may not have left. Halt for a human.
      await journalUpdateState(entry.id, "failed", {
        error: `Broadcast failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      await setResidentHalt(true);
      report.halted = true;
      return report;
    }
    await journalUpdateState(entry.id, "broadcast", { txHash });

    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        timeoutMs: RECEIPT_TIMEOUT_MS,
      });
      if (receipt.status === "success") {
        await journalUpdateState(entry.id, "confirmed");
      } else {
        await journalUpdateState(entry.id, "failed", {
          error: "Reverted on chain",
        });
        await setResidentHalt(true);
        report.halted = true;
      }
    } catch {
      // Timeout: do NOT mark failed — leave `broadcast` for the next run's
      // reconciliation (the receipt usually just hasn't landed yet).
      report.errors.push(
        `receipt wait timed out for ${txHash} — left in broadcast state for reconciliation`
      );
    }
    return report;
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
    return report;
  } finally {
    await releaseLock(LOCK_NAME);
  }
}
