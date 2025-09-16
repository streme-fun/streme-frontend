"use client";

import { useWallet } from "@/src/hooks/useWallet";
import { useAccount, useConnect } from "wagmi";
import { useSafeWalletAuth, useSafeWallets } from "@/src/hooks/useSafeWallet";

export default function DebugWalletPage() {
  const wallet = useWallet();
  const wagmiAccount = useAccount();
  const { connectors } = useConnect();
  const authState = useSafeWalletAuth();
  const { wallets } = useSafeWallets();

  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Wallet Debug Page</h1>

      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-semibold mb-4">useWallet Hook</h2>
        <pre className="bg-base-300 p-4 rounded overflow-auto">
          {JSON.stringify(wallet, null, 2)}
        </pre>
      </div>

      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Wagmi Account</h2>
        <pre className="bg-base-300 p-4 rounded overflow-auto">
          {JSON.stringify(
            {
              address: wagmiAccount.address,
              isConnected: wagmiAccount.isConnected,
              isConnecting: wagmiAccount.isConnecting,
              isDisconnected: wagmiAccount.isDisconnected,
              connector: wagmiAccount.connector?.id,
              chain: wagmiAccount.chain?.name,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Wallet Auth State</h2>
        <pre className="bg-base-300 p-4 rounded overflow-auto">
          {JSON.stringify(
            {
              authenticated: authState.authenticated,
              ready: authState.ready,
              user: authState.user?.wallet?.address,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Connector Wallets</h2>
        <pre className="bg-base-300 p-4 rounded overflow-auto">
          {JSON.stringify(
            wallets.map((w) => ({
              address: w.address,
            })),
            null,
            2
          )}
        </pre>
      </div>

      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Available Connectors</h2>
        <pre className="bg-base-300 p-4 rounded overflow-auto">
          {JSON.stringify(
            connectors.map((c) => ({
              id: c.id,
              name: c.name,
              ready: c.ready,
            })),
            null,
            2
          )}
        </pre>
      </div>

      <div className="card bg-base-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="space-x-4">
          <button className="btn btn-primary" onClick={() => wallet.connect()}>
            Connect Wallet
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => wallet.disconnect()}
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
