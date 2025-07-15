"use client";

import Link from "next/link";
import { ExternalLink } from "./ui/ExternalLink";

export function HowItWorksModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-base-100 w-full max-w-lg mx-4 p-8 shadow-xl border border-black/[.1] dark:border-white/[.1]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn btn-ghost btn-sm"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-6">Streme 101</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-primary">
              Create Tokens with Built-in Staking
            </h3>
            <p className="opacity-80">
              Create tokens with automatic staking rewards. 20% of supply
              streams to stakers over 365 days.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 text-secondary">
              Stake for Streaming Rewards
            </h3>
            <p className="opacity-80">
              Stake to earn streaming rewards proportional to your share of the
              pool, streamed to your wallet every second. No claiming needed.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 text-accent">
              Streme to Earn $SUP
            </h3>
            <p className="opacity-80">
              Every action you can do on Streme earns Superfluid $SUP. Launch,
              trade, stake, and hold to maximize your claim.
            </p>
          </div>
          {/* Add launch a token button */}
          <div>
            <div className="text-center pt-4">
              <Link href="/create" className="btn btn-primary btn-lg w-full">
                Create Your Streme Token
              </Link>
            </div>
          </div>
          {/* Add docs link */}
          <div className="text-center">
            <ExternalLink
              href="https://docs.streme.fun"
              className="text-sm text-base-content/60 hover:text-base-content/80"
            >
              Read the Docs →
            </ExternalLink>
          </div>
        </div>
      </div>
    </div>
  );
}
