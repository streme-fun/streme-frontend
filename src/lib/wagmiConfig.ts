import { http, fallback, createConfig } from "wagmi";
import { base } from "wagmi/chains";

// RPC endpoints for Base (same as viemClient.ts)
export const baseRpcEndpoints = [
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6",
  "https://mainnet.base.org",
  "https://developer-access-mainnet.base.org",
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!,
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
].filter(Boolean);

// Shared transport configuration
export const baseTransport = fallback(
  baseRpcEndpoints.map((url) =>
    http(url, {
      timeout: 10_000,
      retryCount: 2,
      retryDelay: 1000,
      batch: true,
    })
  ),
  { rank: false }
);

// Shared config for utilities that need to read from the blockchain
// This doesn't include connectors since those are provider-specific
export const sharedConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: baseTransport,
  },
});