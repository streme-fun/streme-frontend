"use client";

// Copy-trade control for Agent Floor feed items (plan U6).
//
// Thin shell over copyTradeLogic.ts (the testable matrix). Flow:
//   eligible item → "Copy buy" / "Copy stake" / "Buy & auto-stake instead"
//   → rebuild through the public REST builder (fresh quote, server-side
//     revalidation: blacklist, staking address, pool)
//   → inline confirm panel with the built description + risk framing (R9)
//   → dual-path signing copied in shape from StakeButton (mini-app
//     eth_sendTransaction with chainId "0x2105"; browser walletClient).
//
// Build failures (blacklisted now, no staking address, quote revert, any
// 4xx/5xx) become an inline disabled "No longer available" state — there is
// never a signable tx after a failed rebuild.
//
// Deliberate deviation from StakeButton: NO Divvi referral tag. The gateway
// build already ends in the Floor watermark suffix and its fingerprint
// (keccak of to+data) is stored at build time — appending the referral tag
// would change the broadcast calldata, break the tier-1 fingerprint match,
// and demote the copy event's verification tier. Skipped on purpose.

import { useCallback, useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { publicClient } from "@/src/lib/viemClient";
import { useUnifiedWallet } from "@/src/hooks/useUnifiedWallet";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics";
import type { BuiltTransaction } from "@/src/lib/agent/txBuilders";
import type { FloorEvent } from "@/src/lib/floor/store";
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
  type CopyBuildRequest,
} from "./copyTradeLogic";

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

class CopyBuildUnavailableError extends Error {}

/** POST the rebuild; any failure means "no longer available", never a tx. */
async function buildCopyTx(
  request: CopyBuildRequest
): Promise<BuiltTransaction> {
  let response: Response;
  try {
    response = await fetch(`/api/agent/tx/${request.action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
  } catch {
    throw new CopyBuildUnavailableError("Could not reach the trade builder");
  }
  if (!response.ok) {
    let reason = `Trade could not be rebuilt (HTTP ${response.status})`;
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error) {
        reason = payload.error;
      }
    } catch {
      // keep the generic reason
    }
    throw new CopyBuildUnavailableError(reason);
  }
  return (await response.json()) as BuiltTransaction;
}

type CopyMode = "buy" | "stake" | "buy_substitute";

type Phase =
  | { step: "idle" }
  | { step: "preparing" }
  | {
      step: "confirm";
      mode: CopyMode;
      built: BuiltTransaction;
      /** Stake copies: true when clamped down to the viewer's balance */
      clamped?: boolean;
      /** Stake copies: the resolved decimal token amount */
      amountTokens?: string;
      /** Buy-substitute: the editable ETH amount currently in the input */
      ethAmount?: string;
      /** Buy-substitute: the ETH amount `built` was quoted for */
      builtForEth?: string;
    }
  | { step: "unavailable"; reason: string }
  | { step: "done" };

function extractSigningErrorMessage(error: unknown): string {
  let message = "Copy trade failed.";
  if (typeof error === "object" && error !== null) {
    const err = error as { message?: unknown; shortMessage?: unknown };
    if (typeof err.message === "string") {
      if (
        err.message.includes("User rejected") ||
        err.message.includes("cancelled") ||
        err.message.includes("hash not received")
      ) {
        return "Transaction rejected or cancelled.";
      }
      message = err.message.substring(0, 100);
    } else if (typeof err.shortMessage === "string") {
      message = err.shortMessage;
    }
  }
  return message;
}

interface CopyTradeButtonProps {
  event: FloorEvent;
}

export default function CopyTradeButton({ event }: CopyTradeButtonProps) {
  const { isConnected, address, connect, isEffectivelyMiniApp } =
    useUnifiedWallet();
  const { data: walletClient } = useWalletClient();
  const { getSafeEthereumProvider } = useAppFrameLogic();
  const postHog = usePostHog();

  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [isSigning, setIsSigning] = useState(false);
  // Viewer's token balance for stake events — drives the idle label
  // (null = unknown/loading; refetched fresh at click time for decisions).
  const [labelBalance, setLabelBalance] = useState<bigint | null>(null);

  const eligible = isCopyEligible(event);
  const isStakeEvent = event.kind === "stake";
  const token = event.token as `0x${string}` | undefined;

  const fetchBalance = useCallback(async (): Promise<bigint> => {
    if (!token || !address) return 0n;
    const balance = await publicClient.readContract({
      address: token,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return balance as bigint;
  }, [token, address]);

  // Stake items show their mode up front ("Copy stake" vs the buy
  // substitute) — same on-mount balanceOf approach as StakeButton.
  useEffect(() => {
    if (!eligible || !isStakeEvent || !address) return;
    let cancelled = false;
    fetchBalance()
      .then((balance) => {
        if (!cancelled) setLabelBalance(balance);
      })
      .catch((error) => {
        console.warn("CopyTradeButton: balance fetch failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, isStakeEvent, address, fetchBalance]);

  if (!eligible) return null;

  const handleOpen = async () => {
    // Disconnected click is a connect request, never an error (no toasts).
    if (!isConnected || !address) {
      connect();
      return;
    }

    setPhase({ step: "preparing" });
    try {
      if (event.kind === "buy") {
        const built = await buildCopyTx(shapeBuyCopyRequest(event));
        setPhase({ step: "confirm", mode: "buy", built });
        return;
      }

      // Stake copy: fresh balance at decision time, then the clamp matrix.
      const balance = await fetchBalance();
      setLabelBalance(balance);
      const resolution = resolveStakeAmount(balance, event.amountToken);
      if (resolution.mode === "stake") {
        const built = await buildCopyTx(
          shapeStakeCopyRequest(event, resolution.amountTokens)
        );
        setPhase({
          step: "confirm",
          mode: "stake",
          built,
          clamped: resolution.clamped,
          amountTokens: resolution.amountTokens,
        });
      } else {
        const built = await buildCopyTx(
          shapeBuySubstituteRequest(event, DEFAULT_BUY_SUBSTITUTE_ETH)
        );
        setPhase({
          step: "confirm",
          mode: "buy_substitute",
          built,
          ethAmount: DEFAULT_BUY_SUBSTITUTE_ETH,
          builtForEth: DEFAULT_BUY_SUBSTITUTE_ETH,
        });
      }
    } catch (error) {
      const reason =
        error instanceof CopyBuildUnavailableError
          ? error.message
          : "Could not prepare this trade";
      setPhase({ step: "unavailable", reason });
    }
  };

  const signBuilt = async (built: BuiltTransaction, mode: CopyMode) => {
    setIsSigning(true);
    const toastId = toast.loading("Preparing copy trade...");
    try {
      let txHash: `0x${string}` | undefined;

      if (isEffectivelyMiniApp) {
        const ethProvider = await getSafeEthereumProvider();
        if (!ethProvider)
          throw new Error("Farcaster Ethereum provider not available.");
        toast.loading("Confirm in your wallet...", { id: toastId });
        txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          // chainId 8453 → "0x2105"; value (hex wei) passes through.
          params: [shapeMiniAppTxParams(built.tx, address!)],
        });
        if (!txHash)
          throw new Error(
            "Transaction hash not received. User might have cancelled."
          );
        toast.loading("Waiting for confirmation...", { id: toastId });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        if (receipt.status !== "success")
          throw new Error("Copy trade transaction failed");
      } else {
        if (!walletClient) throw new Error("Wallet client not available");
        toast.loading("Confirm in your wallet...", { id: toastId });
        txHash = await walletClient.sendTransaction({
          to: built.tx.to,
          data: built.tx.data,
          ...(built.tx.value ? { value: BigInt(built.tx.value) } : {}),
          account: address as `0x${string}`,
          chain: undefined,
        });
        if (!txHash)
          throw new Error(
            "Transaction hash not received. User might have cancelled."
          );
        toast.loading("Waiting for confirmation...", { id: toastId });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        if (receipt.status !== "success")
          throw new Error("Copy trade transaction failed");
      }

      toast.success("Copy trade confirmed!", { id: toastId });
      postHog.capture(POSTHOG_EVENTS.COPY_TRADE_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOKEN_ADDRESS]: event.token,
        [ANALYTICS_PROPERTIES.COPY_MODE]: mode,
        [ANALYTICS_PROPERTIES.SOURCE_TX_HASH]: event.txHash,
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: address,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isEffectivelyMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: txHash,
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isEffectivelyMiniApp
          ? "farcaster"
          : "privy",
      });
      setPhase({ step: "done" });
    } catch (error) {
      console.error("CopyTradeButton signing error:", error);
      toast.error(extractSigningErrorMessage(error), { id: toastId });
      // Stay on the confirm panel so the viewer can retry or cancel.
    } finally {
      setIsSigning(false);
    }
  };

  const handleConfirm = async () => {
    if (phase.step !== "confirm" || isSigning) return;

    if (phase.mode === "buy_substitute") {
      const ethAmount = parseEthInput(phase.ethAmount ?? "");
      if (!ethAmount) return;
      // Edited amount → rebuild first so the signed tx (and the description
      // the viewer just read) match what they typed.
      if (ethAmount !== phase.builtForEth) {
        try {
          const built = await buildCopyTx(
            shapeBuySubstituteRequest(event, ethAmount)
          );
          setPhase({
            ...phase,
            built,
            ethAmount,
            builtForEth: ethAmount,
          });
        } catch (error) {
          const reason =
            error instanceof CopyBuildUnavailableError
              ? error.message
              : "Could not prepare this trade";
          setPhase({ step: "unavailable", reason });
        }
        return;
      }
    }

    await signBuilt(phase.built, phase.mode);
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (phase.step === "done") {
    return (
      <span className="badge badge-success badge-outline">
        Copied — confirmed on Base
      </span>
    );
  }

  if (phase.step === "unavailable") {
    // Mirrors StakeButton's disabled+message treatment.
    return (
      <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-1">
        <button className="btn btn-sm btn-outline w-full sm:w-auto" disabled>
          No longer available
        </button>
        <span className="text-xs opacity-60">{phase.reason}</span>
      </div>
    );
  }

  if (phase.step === "confirm") {
    const ethInputInvalid =
      phase.mode === "buy_substitute" &&
      parseEthInput(phase.ethAmount ?? "") === null;
    const needsRequote =
      phase.mode === "buy_substitute" &&
      !ethInputInvalid &&
      parseEthInput(phase.ethAmount ?? "") !== phase.builtForEth;

    return (
      <div className="w-full basis-full bg-base-200 rounded-box p-3 space-y-2">
        <p className="text-sm font-medium">{phase.built.description}</p>

        {phase.mode === "stake" && phase.clamped && (
          <p className="text-xs text-warning">
            Your balance is below the original stake — clamped to your{" "}
            <span className="font-mono">{phase.amountTokens}</span> tokens
            {event.amountToken ? (
              <>
                {" "}
                (original:{" "}
                <span className="font-mono">{event.amountToken}</span>)
              </>
            ) : null}
            .
          </p>
        )}

        {phase.mode === "buy_substitute" && (
          <label className="form-control w-full">
            <span className="label-text text-xs mb-1">
              You don&apos;t hold this token yet — buy and auto-stake instead.
              ETH amount:
            </span>
            <input
              type="text"
              inputMode="decimal"
              className={`input input-sm input-bordered w-full font-mono ${
                ethInputInvalid ? "input-error" : ""
              }`}
              value={phase.ethAmount ?? ""}
              onChange={(e) =>
                setPhase({ ...phase, ethAmount: e.target.value })
              }
              disabled={isSigning}
              aria-label="ETH amount to buy and auto-stake"
            />
          </label>
        )}

        <p className="text-xs opacity-70">{COPY_TRADE_RISK_COPY}</p>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-sm btn-primary flex-1 sm:flex-none"
            onClick={handleConfirm}
            disabled={isSigning || ethInputInvalid}
          >
            {isSigning
              ? "Signing..."
              : needsRequote
                ? "Update quote"
                : "Confirm & sign"}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setPhase({ step: "idle" })}
            disabled={isSigning}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const idleLabel = !isConnected
    ? "Connect to copy"
    : event.kind === "buy"
      ? "Copy buy"
      : labelBalance !== null && labelBalance === 0n
        ? "Buy & auto-stake instead"
        : "Copy stake";

  return (
    <button
      className="btn btn-sm btn-outline btn-primary w-full sm:w-auto"
      onClick={handleOpen}
      disabled={phase.step === "preparing"}
    >
      {phase.step === "preparing" ? (
        <>
          <span className="loading loading-spinner loading-xs" />
          Preparing...
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}
