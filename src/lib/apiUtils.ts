import { Token } from "@/src/app/types/token";

export async function fetchTokensFromStreme(
  before?: number,
  limit: number = 200
): Promise<Token[]> {
  try {
    const params = new URLSearchParams();
    params.append("type", "all");
    if (before) params.append("before", before.toString());
    if (limit) params.append("limit", limit.toString());

    const queryString = params.toString();
    const url = `https://api.streme.fun/api/tokens?${queryString}`;

    const response = await fetch(url, {
      cache: "no-store",
    });
    const tokens = await response.json();
    // Return the tokens array directly if it's not wrapped in data
    return Array.isArray(tokens) ? tokens : tokens.data || [];
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return [];
  }
}

type EnrichedToken = Omit<Token, "creator"> & {
  creator?: {
    name: string;
    score: number;
    recasts: number;
    likes: number;
    profileImage: string;
  };
};

export async function enrichTokensWithData(
  tokens: Token[]
): Promise<EnrichedToken[]> {
  if (!Array.isArray(tokens)) {
    console.error("Expected tokens array, got:", tokens);
    return [];
  }

  // Transform tokens and use only market data from Streme API
  const enrichedTokens = tokens.map((token) => {
    // Process vault data from backend's vaults array
    interface BackendVault {
      vault: string;
      token: string;
      admin: string;
      supply: number;
      lockupDuration: number;
      vestingDuration: number;
      pool: string;
      box: string;
      lockupEndTime?: number;
      vestingEndTime?: number;
    }
    const backendVaults = (token as Token & { vaults?: BackendVault[] }).vaults;
    const vault = backendVaults && backendVaults.length > 0
      ? {
          allocation: 0, // Will be calculated below
          beneficiary: backendVaults[0].admin,
          admin: backendVaults[0].admin,
          lockDuration: backendVaults[0].lockupDuration,
          vestingDuration: backendVaults[0].vestingDuration,
          supply: backendVaults[0].supply,
          pool: backendVaults[0].pool,
          box: backendVaults[0].box,
          lockupEndTime: backendVaults[0].lockupEndTime,
          vestingEndTime: backendVaults[0].vestingEndTime,
        }
      : undefined;

    // Calculate allocations if we have staking data
    let allocations = undefined;
    if (token.staking || vault) {
      const totalSupply = 100000000000; // 100B tokens (constant)
      const stakingAllocation = token.staking
        ? Math.round((token.staking.supply / totalSupply) * 100)
        : 0;
      const vaultAllocation = vault
        ? Math.round((vault.supply / totalSupply) * 100)
        : 0;
      const liquidityAllocation = 100 - stakingAllocation - vaultAllocation;

      allocations = {
        staking: stakingAllocation,
        vault: vaultAllocation,
        liquidity: liquidityAllocation,
      };

      // Update vault allocation percentage
      if (vault) {
        vault.allocation = vaultAllocation;
      }
    }

    // Add allocation percentage to staking config
    const stakingWithAllocation = token.staking ? {
      ...token.staking,
      allocation: allocations?.staking,
    } : undefined;

    return {
      ...token,
      staking: stakingWithAllocation,
      vault,
      allocations,
      creator: token.requestor_fid
        ? {
            name: token.username || "Unknown",
            score: 0,
            recasts: 0,
            likes: 0,
            profileImage: token.pfp_url || "",
          }
        : undefined,
      // Use market data from Streme API only
      price: token.marketData?.price,
      marketCap: token.marketData?.marketCap,
      volume24h: token.marketData?.volume24h,
      change1h: token.marketData?.priceChange1h,
      change24h: token.marketData?.priceChange24h,
    };
  }) as EnrichedToken[];

  return enrichedTokens;
}

export async function fetchTokenFromStreme(
  address: string
): Promise<Token | null> {
  if (!address) {
    console.error("No address provided to fetchTokenFromStreme");
    return null;
  }

  try {
    const normalizedAddress = address.toLowerCase();
    // console.log("Fetching token data for:", normalizedAddress);

    // Add timeout to external API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://api.streme.fun/token/${normalizedAddress}`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Streme/1.0",
        },
      }
    ).finally(() => {
      clearTimeout(timeoutId);
    });

    // console.log(`External API response status: ${response.status}`);

    // Handle different response statuses more explicitly
    if (response.status >= 500) {
      throw new Error(
        `External service unavailable (status: ${response.status})`
      );
    }

    if (response.status === 429) {
      throw new Error(`Rate limited by external service`);
    }

    if (!response.ok) {
      console.warn(`External API returned status ${response.status}`);
      return null;
    }

    const tokenJson = await response.json();
    // console.log("Raw token response:", tokenJson);

    if (tokenJson.message === "No such document!" || tokenJson.errors) {
      // Token doesn't exist in the external API - this is expected for some tokens
      return null;
    }

    // Check if we have actual token data
    const token = tokenJson.data ? tokenJson.data : tokenJson;
    if (!token.contract_address) {
      console.error("Invalid token data received:", token);
      return null;
    }

    return token;
  } catch (error) {
    console.error("Error fetching token:", error);

    // Re-throw errors that indicate service issues so they can be retried
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("External service timeout");
      }
      if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        throw new Error("Network error connecting to external service");
      }
      if (
        error.message.includes("service unavailable") ||
        error.message.includes("503")
      ) {
        throw error; // Re-throw service unavailable errors
      }
    }

    // For other errors, return null (token not found, etc.)
    return null;
  }
}
