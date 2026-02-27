"use client";

import { useState, useEffect } from "react";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";
import { useSnapshotVote } from "../hooks/useSnapshotVote";

const DISMISSED_KEY = "streme-vote-s5-dismissed";

export function VoteBanner() {
  const {
    isConnected,
    address,
    isEffectivelyMiniApp: isMiniApp,
  } = useUnifiedWallet();

  const { vote, isVoting, hasVoted, error } = useSnapshotVote(address);

  const [dismissed, setDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check dismissed state from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
    }
  }, []);

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Show success state when vote completes
  useEffect(() => {
    if (hasVoted) {
      setShowSuccess(true);
    }
  }, [hasVoted]);

  // Don't render if: not mini-app, not connected, already voted, or dismissed
  if (!isMiniApp || !isConnected || dismissed) {
    return null;
  }

  // Success state
  if (showSuccess) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-success/30 bg-success/10 p-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <span className="font-semibold text-sm text-base-content">
            Thanks for voting for Streme!
          </span>
        </div>
      </div>
    );
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-base-100 p-4 mb-2">
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 pointer-events-none" />

      <div className="relative flex flex-col gap-3">
        {/* Top row: icon + text + dismiss */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg">
            🗳️
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="font-semibold text-sm text-base-content leading-tight">
              Vote for Streme
            </span>
            <span className="text-xs text-base-content/60 leading-tight">
              Season 5 $SUP Rewards
            </span>
          </div>
          <button
            className="btn btn-ghost btn-xs btn-square rounded-lg opacity-40 hover:opacity-100"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <span className="text-xs text-error">{error}</span>
        )}

        {/* Bottom row: full-width button */}
        <button
          className="btn btn-primary btn-outline btn-sm w-full"
          onClick={vote}
          disabled={isVoting}
        >
          {isVoting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            "Vote 100% for Streme"
          )}
        </button>
      </div>
    </div>
  );
}
