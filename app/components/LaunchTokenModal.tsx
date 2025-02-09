"use client";

export function LaunchTokenModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const launchText = `@streme Hey! I'd love to launch a token on streme.fun 🚀

Name: [your token name]
Symbol: $[your ticker]

[Don't forget to attach an image!] 🎨`;

  const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(
    launchText
  )}`;

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

        <h2 className="text-2xl font-bold mb-6">
          Launch a Token on STREME.FUN
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-primary">
              How to Launch
            </h3>
            <p className="opacity-80">
              Launching a token on STREME.FUN is as simple as casting on
              Farcaster! Just mention @streme in your cast with your token
              details.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-secondary">
              Required Information
            </h3>
            <ul className="list-disc list-inside opacity-80 space-y-2">
              <li>Token Name (e.g., &quot;Based Pepe&quot;)</li>
              <li>Token Symbol (e.g., &quot;PEPE&quot;)</li>
              <li>Token Image (attach to your cast)</li>
              <li>Mention @streme</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-accent">
              What Happens Next
            </h3>
            <p className="opacity-80">
              Once you cast, our system will automatically process your request
              and deploy your token. You&apos;ll receive a reply with your token
              details and contract address.
            </p>
          </div>

          <div className="pt-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-secondary to-accent rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-glow"></div>
              <a
                href={warpcastUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative btn btn-primary w-full"
              >
                Launch Token on Warpcast
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
