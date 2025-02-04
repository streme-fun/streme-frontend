"use client";

interface TokenPageContentProps {
  address: string;
}

export function TokenPageContent({ address }: TokenPageContentProps) {
  // Build the embed URL dynamically using the token address
  const embedUrl = `https://www.geckoterminal.com/base/pools/${address}?embed=1&info=0&swaps=1&grayscale=0&light_chart=1`;

  return (
    <div className="flex gap-6 p-4">
      {/* Main content area with chart */}
      <div className="flex-1">
        <div className="bg-base-100 rounded-lg shadow-md p-4">
          <iframe
            data-privy-ignore
            height="800"
            width="100%"
            id="geckoterminal-embed"
            title="GeckoTerminal Embed"
            src={embedUrl}
            frameBorder="0"
            allow="clipboard-write"
            allowFullScreen
          ></iframe>
        </div>
      </div>

      {/* Right sidebar with token details and actions */}
      <div className="w-80 space-y-4">
        {/* Token Info Card */}
        <div className="bg-base-100 rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
            <div>
              <h2 className="text-xl font-bold">$TokenName</h2>
              <p className="text-sm text-gray-500">$Symbol</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Market Cap</span>
              <span>$19.83m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Volume 24h</span>
              <span>$176.73k</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Holders</span>
              <span>12</span>
            </div>
          </div>
        </div>

        {/* Swap Card */}
        <div className="bg-base-100 rounded-lg shadow-md p-4">
          <div className="space-y-4">
            {/* From */}
            <div>
              <label className="text-sm text-gray-500">From</label>
              <div className="flex items-center gap-2 p-3 bg-base-200 rounded-lg mt-1">
                <input
                  type="number"
                  placeholder="0.00"
                  className="bg-transparent w-full focus:outline-none"
                />
                <button className="btn btn-sm">ETH</button>
              </div>
            </div>

            {/* To */}
            <div>
              <label className="text-sm text-gray-500">To</label>
              <div className="flex items-center gap-2 p-3 bg-base-200 rounded-lg mt-1">
                <input
                  type="number"
                  placeholder="0"
                  className="bg-transparent w-full focus:outline-none"
                />
                <button className="btn btn-sm">Token</button>
              </div>
            </div>

            <button className="btn btn-primary w-full">Swap</button>
          </div>
        </div>
      </div>
    </div>
  );
}
