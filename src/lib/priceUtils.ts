// Utility functions for fetching and converting USD prices

interface PriceData {
  eth: number;
  [tokenAddress: string]: number;
}

// Cache for price data to avoid excessive API calls
let priceCache: {
  data: PriceData | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

const CACHE_DURATION = 60000; // 1 minute cache

// Fetch ETH price from our API route
export async function fetchETHPrice(): Promise<number | null> {
  try {
    const response = await fetch("/api/eth-price");

    if (!response.ok) {
      throw new Error("Failed to fetch ETH price");
    }

    const data = await response.json();
    return data.eth || null;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return null;
  }
}

// Fetch token price using existing API integration
export async function fetchTokenPrice(
  tokenAddress: string
): Promise<number | null> {
  try {
    const response = await fetch(
      `/api/tokens/single?address=${tokenAddress}&type=all`
    );

    if (!response.ok) {
      console.warn(
        `Failed to fetch token data for ${tokenAddress}: ${response.status}`
      );
      return null;
    }

    const data = await response.json();

    // Try multiple possible price sources
    const price =
      data.data?.price ||
      data.data?.marketData?.price ||
      data.price ||
      data.marketData?.price;

    return price && !isNaN(price) ? price : null;
  } catch (error) {
    console.warn(`Error fetching token price for ${tokenAddress}:`, error);
    return null;
  }
}

// Get cached prices or fetch new ones
export async function getPrices(
  tokenAddresses: string[] = []
): Promise<PriceData | null> {
  const now = Date.now();

  // Return cached data if still valid
  if (priceCache.data && now - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.data;
  }

  try {
    // Fetch ETH price first
    const ethPrice = await fetchETHPrice();
    if (!ethPrice) {
      console.warn("Failed to fetch ETH price, using cached data if available");
      return priceCache.data; // Return cached data if ETH price fails
    }

    const prices: PriceData = { eth: ethPrice };

    // Fetch token prices if addresses provided
    for (const address of tokenAddresses) {
      if (address && address.trim()) {
        const tokenPrice = await fetchTokenPrice(address);
        if (tokenPrice) {
          prices[address.toLowerCase()] = tokenPrice;
        }
      }
    }

    // Update cache
    priceCache = {
      data: prices,
      timestamp: now,
    };

    return prices;
  } catch (error) {
    console.error("Error fetching prices:", error);
    // Return cached data if available, otherwise null
    return priceCache.data;
  }
}

// Convert token amount to USD
export function convertToUSD(
  amount: string | number,
  tokenPrice: number | null
): string | null {
  if (!tokenPrice || !amount) return null;

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount) || numAmount <= 0) return null;

  const usdValue = numAmount * tokenPrice;

  if (usdValue < 0.01) {
    return `$${usdValue.toFixed(6)}`;
  } else if (usdValue < 1) {
    return `$${usdValue.toFixed(4)}`;
  } else {
    return `$${usdValue.toFixed(2)}`;
  }
}

// Format USD amount for display
export function formatUSDAmount(usdValue: number): string {
  if (usdValue < 0.01) {
    return `$${usdValue.toFixed(6)}`;
  } else if (usdValue < 1) {
    return `$${usdValue.toFixed(4)}`;
  } else if (usdValue < 1000) {
    return `$${usdValue.toFixed(2)}`;
  } else if (usdValue < 1000000) {
    return `$${(usdValue / 1000).toFixed(1)}K`;
  } else {
    return `$${(usdValue / 1000000).toFixed(1)}M`;
  }
}
