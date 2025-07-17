"use client";

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

        <h2 className="text-2xl font-bold mb-6">How STREME.FUN Works</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-primary">
              Streaming Rewards
            </h3>
            <p className="opacity-80">
              Streme.fun is a token launcher, where every token launched
              automatically streams rewards directly to stakers&apos; wallets -
              no claiming needed.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-secondary">
              Fair Distribution
            </h3>
            <p className="opacity-80">
              20% of each token&apos;s total supply is allocated to the rewards
              pool, distributed over 365 days proportionally to stakers.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-accent">
              Simple Staking
            </h3>
            <p className="opacity-80">
              Staking is simple but secure. When you stake tokens, they&apos;re
              locked for 24 hours. After the lock period, you can unstake
              anytime. Your rewards continue streaming whether they&apos;re
              locked or not.
            </p>
          </div>

          {/* Add docs link */}
          <div className="text-center pt-4">
            <a
              href="https://docs.streme.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Read the full documentation →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}