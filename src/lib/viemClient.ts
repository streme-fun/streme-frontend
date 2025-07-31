import { createPublicClient, http, fallback } from "viem";
import { base } from "viem/chains";
import { balanceCallTracker } from "./debug";

// RPC endpoints in order of preference
const rpcEndpoints = [
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6",
  "https://mainnet.base.org",
  "https://developer-access-mainnet.base.org",
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!,
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
];

const originalPublicClient = createPublicClient({
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

// Create a debug wrapper for readContract
const readContractWithDebug = async (
  args: Parameters<typeof originalPublicClient.readContract>[0]
) => {
  // Log balance calls with component tracking
  if (args.abi && args.functionName === "balanceOf") {
    const stackTrace = new Error().stack || "";

    // Try to identify the calling component from stack trace
    let component = "Unknown";
    if (stackTrace.includes("TokenActions")) component = "TokenActions";
    else if (stackTrace.includes("StakeButton")) component = "StakeButton";
    else if (stackTrace.includes("StakedBalance")) component = "StakedBalance";
    else if (stackTrace.includes("MyTokensModal")) component = "MyTokensModal";
    else if (stackTrace.includes("TokensPage")) component = "TokensPage";
    else if (stackTrace.includes("useTokenBalance"))
      component = "useTokenBalance";
    else if (stackTrace.includes("useTokenData")) component = "useTokenData";
    else if (stackTrace.includes("UnstakeButton")) component = "UnstakeButton";

    balanceCallTracker.trackCall(
      args.address?.toString() || "unknown",
      (args.args?.[0] as string) || "unknown",
      component
    );
  }

  return originalPublicClient.readContract(args);
};

// Create public client with debug wrapper
export const publicClient = {
  ...originalPublicClient,
  readContract: readContractWithDebug,
};

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
            ? (results[index].result as bigint)
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
            return { address, tokenAddress, balance: balance as bigint };
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
