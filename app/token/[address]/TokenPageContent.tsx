"use client";

import { TokenActions } from "./TokenActions";
import { Token } from "@/app/types/token";

interface TokenPageContentProps {
  initialToken: Token;
}

export function TokenPageContent({ initialToken }: TokenPageContentProps) {
  // Use the token's pool address for the chart
  const embedUrl = `https://www.geckoterminal.com/base/pools/${initialToken.pool_address}?embed=1&info=0&swaps=1&grayscale=0&light_chart=1`;

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
          <TokenActions token={initialToken} />
        </div>
      </div>
    </div>
  );
}
