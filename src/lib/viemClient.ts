import { createPublicClient, http, fallback } from "viem";
import { base } from "viem/chains";

const alchemyBaseUrl = process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL;

// Multiple RPC endpoints for better reliability and rate limit handling
const rpcEndpoints = [
  // Primary: Your Alchemy endpoint (if available)
  ...(alchemyBaseUrl ? [alchemyBaseUrl] : []),
  // Fallback public RPCs for Base
  "https://base.llamarpc.com",
  "https://base-rpc.publicnode.com",
  "https://base.blockpi.network/v1/rpc/public",
  "https://1rpc.io/base",
];

export const publicClient = createPublicClient({
  chain: base,
  transport: fallback(
    rpcEndpoints.map((url) =>
      http(url, {
        timeout: 10_000, // 10 second timeout
        retryCount: 2, // Retry failed requests 2 times
        retryDelay: 1000, // 1 second delay between retries
      })
    ),
    {
      rank: false, // Use endpoints in order (don't rank by performance)
    }
  ),
});
