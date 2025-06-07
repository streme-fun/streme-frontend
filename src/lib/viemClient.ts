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
        batch: true, // Enable request batching
      })
    ),
    {
      rank: false, // Use endpoints in order (don't rank by performance)
    }
  ),
});

// Request batching utility to reduce RPC calls
class RequestBatcher {
  private static instance: RequestBatcher;
  private pendingRequests = new Map<string, Promise<unknown>>();
  private batchTimeout: NodeJS.Timeout | null = null;

  static getInstance(): RequestBatcher {
    if (!RequestBatcher.instance) {
      RequestBatcher.instance = new RequestBatcher();
    }
    return RequestBatcher.instance;
  }

  async batchContractRead<T>(
    key: string,
    contractCall: () => Promise<T>
  ): Promise<T> {
    // If we already have a pending request for this key, return it
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Create the promise and cache it
    const promise = contractCall();
    this.pendingRequests.set(key, promise);

    // Clean up after the request completes
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });

    return promise;
  }

  // Batch multiple balance calls for efficiency
  async batchBalanceOf(
    requests: Array<{ address: string; tokenAddress: string }>
  ): Promise<
    Array<{ address: string; tokenAddress: string; balance: bigint }>
  > {
    const balanceABI = [
      {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const;

    try {
      const results = await publicClient.multicall({
        contracts: requests.map(({ address, tokenAddress }) => ({
          address: tokenAddress as `0x${string}`,
          abi: balanceABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        })),
      });

      return requests.map((request, index) => ({
        ...request,
        balance:
          results[index].status === "success"
            ? results[index].result
            : BigInt(0),
      }));
    } catch (error) {
      console.error("Batch balance call failed:", error);
      // Fallback to individual calls
      const fallbackResults = await Promise.all(
        requests.map(async ({ address, tokenAddress }) => {
          try {
            const balance = await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: balanceABI,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            });
            return { address, tokenAddress, balance };
          } catch (err) {
            console.warn(`Failed to fetch balance for ${tokenAddress}:`, err);
            return { address, tokenAddress, balance: BigInt(0) };
          }
        })
      );
      return fallbackResults;
    }
  }
}

export const requestBatcher = RequestBatcher.getInstance();
