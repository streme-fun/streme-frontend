"use client";

import { useAccount, useConnect } from "wagmi";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";

export function FarcasterWalletDebug() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { isSDKLoaded, isMiniAppView, farcasterContext } = useAppFrameLogic();

  if (!isMiniAppView) {
    return null; // Only show in miniapp context
  }

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg z-50 max-w-sm">
      <h3 className="font-bold text-sm mb-2">Farcaster Wallet Debug</h3>
      <div className="text-xs space-y-1">
        <div>SDK Loaded: {isSDKLoaded ? "✅" : "❌"}</div>
        <div>Mini App: {isMiniAppView ? "✅" : "❌"}</div>
        <div>Has Context: {farcasterContext ? "✅" : "❌"}</div>
        <div>Connected: {isConnected ? "✅" : "❌"}</div>
        <div>
          Address:{" "}
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "None"}
        </div>
        <div>Connector: {connector?.id || "None"}</div>
        <div>Available Connectors: {connectors.length}</div>
        <div className="text-xs">
          {connectors.map((c, i) => (
            <div key={c.id}>
              {i}: {c.id} ({c.name})
            </div>
          ))}
        </div>

        {!isConnected && (
          <div className="mt-2 space-y-1">
            <button
              onClick={() => {
                const farcasterConnector =
                  connectors.find((c) => c.id === "farcaster") || connectors[0];
                if (farcasterConnector) {
                  console.log(
                    "Manual connect attempt with:",
                    farcasterConnector.id
                  );
                  connect({ connector: farcasterConnector });
                }
              }}
              className="bg-blue-500 text-white px-2 py-1 rounded text-xs w-full"
            >
              Manual Connect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
