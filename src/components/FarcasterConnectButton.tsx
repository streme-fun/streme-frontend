"use client";

import { useAccount, useConnect } from "wagmi";

export function FarcasterConnectButton() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();

  if (isConnected) {
    return (
      <div className="text-center">
        <div>You're connected!</div>
        <div>Address: {address}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect({ connector: connectors[0] })}
      className="btn btn-primary"
    >
      Connect
    </button>
  );
}
