"use client";

import { TokenActions } from "./TokenActions";

// interface TokenPageContentProps {
//   address: string;
// }

export function TokenPageContent() {
  // Build the embed URL dynamically using the token address
  const embedUrl = `https://www.geckoterminal.com/base/pools/0x493ad7e1c509de7c89e1963fe9005ead49fdd19c?embed=1&info=0&swaps=1&grayscale=0&light_chart=1`;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        {/* Chart */}
        <div className="lg:col-span-8 card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
          <div className="card-body p-4">
            <iframe
              data-privy-ignore
              title="GeckoTerminal Embed"
              src={embedUrl}
              className="w-full h-[500px] lg:h-[800px]"
              allow="clipboard-write"
              allowFullScreen
            />
          </div>
        </div>

        {/* Trading Interface */}
        <div className="lg:col-span-4">
          <TokenActions />
        </div>
      </div>
    </div>
  );
}
