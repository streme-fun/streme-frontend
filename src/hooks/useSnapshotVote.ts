"use client";

import { useState, useEffect, useCallback } from "react";
import { buildVoteTypedData, submitVote } from "../lib/snapshotVote";
import sdk from "@farcaster/miniapp-sdk";

const VOTED_KEY = "streme-vote-s5-completed";

export function useSnapshotVote(address: string | undefined) {
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasVoted(localStorage.getItem(VOTED_KEY) === "true");
    }
  }, []);

  const vote = useCallback(async () => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    setIsVoting(true);
    setError(null);

    try {
      // Build fresh typed data (timestamp generated inside)
      const typedData = buildVoteTypedData(address);

      // Get the Farcaster mini-app Ethereum provider
      const ethProvider = await sdk.wallet.getEthereumProvider();
      if (!ethProvider) {
        throw new Error("Ethereum provider not available");
      }

      // Sign EIP-712 typed data
      const signature = (await ethProvider.request({
        method: "eth_signTypedData_v4",
        params: [
          address as `0x${string}`,
          JSON.stringify({
            domain: typedData.domain,
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: typedData.message,
          }),
        ],
      })) as string;

      // Submit to Snapshot sequencer
      await submitVote(address, signature, typedData);

      // Persist success
      setHasVoted(true);
      if (typeof window !== "undefined") {
        localStorage.setItem(VOTED_KEY, "true");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Vote failed. Please try again.";
      setError(message);
      console.error("Snapshot vote error:", err);
    } finally {
      setIsVoting(false);
    }
  }, [address]);

  return { vote, isVoting, hasVoted, error };
}
