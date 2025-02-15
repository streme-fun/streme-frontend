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
              Instant Reward Streaming
            </h3>
            <p className="opacity-80">
              Every token launched on STREME.FUN automatically streams rewards
              directly to stakers. No waiting periods, no claims needed -
              rewards flow straight to your wallet in real-time through
              Superfluid.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-secondary">
              Fair Distribution
            </h3>
            <p className="opacity-80">
              20% of each token&apos;s total supply is allocated to the rewards
              pool, distributed over 365 days. Your share of rewards is
              proportional to your stake - the more you stake, the more you earn
              through continuous streaming.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-accent">
              Secure Staking
            </h3>
            <p className="opacity-80">
              Staking is simple but secure. When you stake tokens, they&apos;re
              locked for 24 hours to ensure system stability. After the lock
              period, you can unstake anytime. Your rewards continue streaming
              during the lock period - just stake and watch your balance grow in
              real-time.
            </p>
          </div>

          <div className="bg-base-200 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-info">Quick Tips</h3>
            <ul className="list-disc list-inside opacity-80 space-y-2">
              <li>Rewards start streaming immediately after staking</li>
              <li>24-hour lock period applies to each stake</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
