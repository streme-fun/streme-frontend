"use client";

interface TokenPriceData {
  price: number;
  timestamp: number;
  usdValue?: number;
}

interface PriceCacheData {
  [tokenAddress: string]: TokenPriceData;
}

class PriceCacheService {
  private cache: PriceCacheData = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly BATCH_DELAY = 100; // 100ms batching window
  private pendingRequests = new Map<string, Promise<TokenPriceData | null>>();
  private batchQueue = new Set<string>();
  private batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Get cached price or fetch if not available/expired
   */
  async getPrice(tokenAddress: string): Promise<TokenPriceData | null> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Return cached data if valid
    const cached = this.cache[normalizedAddress];
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(normalizedAddress)) {
      return this.pendingRequests.get(normalizedAddress)!;
    }

    // Add to batch queue and process
    this.batchQueue.add(normalizedAddress);
    const promise = this.processBatch();
    this.pendingRequests.set(normalizedAddress, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(normalizedAddress);
    }
  }

  /**
   * Get multiple prices at once (more efficient)
   */
  async getPrices(
    tokenAddresses: string[]
  ): Promise<Map<string, TokenPriceData | null>> {
    const results = new Map<string, TokenPriceData | null>();

    // Process all addresses
    const promises = tokenAddresses.map(async (address) => {
      const normalizedAddress = address.toLowerCase();
      const priceData = await this.getPrice(normalizedAddress);
      results.set(normalizedAddress, priceData);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Process batch of token requests
   */
  private async processBatch(): Promise<TokenPriceData | null> {
    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Wait for batch window or process immediately if queue is getting large
    if (this.batchQueue.size < 5) {
      await new Promise((resolve) => {
        this.batchTimeout = setTimeout(resolve, this.BATCH_DELAY);
      });
    }

    const addressesToFetch = Array.from(this.batchQueue);
    this.batchQueue.clear();
    this.batchTimeout = null;

    if (addressesToFetch.length === 0) {
      return null;
    }

    try {
      // Fetch prices for all addresses in batch
      const results = await this.fetchPricesBatch(addressesToFetch);

      // Update cache with results
      results.forEach((priceData, address) => {
        if (priceData) {
          this.cache[address] = priceData;
        }
      });

      // Return the first result (for single requests)
      return results.get(addressesToFetch[0]) || null;
    } catch (error) {
      console.error("Error fetching prices batch:", error);
      return null;
    }
  }

  /**
   * Fetch prices for multiple tokens using existing API
   */
  private async fetchPricesBatch(
    addresses: string[]
  ): Promise<Map<string, TokenPriceData | null>> {
    const results = new Map<string, TokenPriceData | null>();
    const timestamp = Date.now();

    // For now, fetch individually but with smarter caching
    // In the future, we could implement a bulk API endpoint
    const promises = addresses.map(async (address) => {
      try {
        const response = await fetch(
          `/api/tokens/single?address=${address}&type=all`
        );

        if (!response.ok) {
          results.set(address, null);
          return;
        }

        const data = await response.json();
        const price =
          data.data?.price ||
          data.data?.marketData?.price ||
          data.price ||
          data.marketData?.price;

        if (price && !isNaN(price)) {
          results.set(address, {
            price: parseFloat(price),
            timestamp,
          });
        } else {
          results.set(address, null);
        }
      } catch (error) {
        console.warn(`Error fetching price for ${address}:`, error);
        results.set(address, null);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Preload prices for commonly used tokens
   */
  async preloadPrices(tokenAddresses: string[]): Promise<void> {
    await this.getPrices(tokenAddresses);
  }

  /**
   * Clear expired cache entries
   */
  public cleanupCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach((address) => {
      if (now - this.cache[address].timestamp > this.CACHE_DURATION) {
        delete this.cache[address];
      }
    });
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; addresses: string[]; oldestEntry: number } {
    const addresses = Object.keys(this.cache);
    const timestamps = addresses.map((addr) => this.cache[addr].timestamp);

    return {
      size: addresses.length,
      addresses,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
    };
  }

  /**
   * Force refresh a specific token's price
   */
  async refreshPrice(tokenAddress: string): Promise<TokenPriceData | null> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Remove from cache to force refresh
    delete this.cache[normalizedAddress];

    return this.getPrice(normalizedAddress);
  }
}

// Singleton instance
export const priceCache = new PriceCacheService();

// Cleanup interval - runs every 10 minutes
if (typeof window !== "undefined") {
  setInterval(() => {
    priceCache.cleanupCache();
  }, 10 * 60 * 1000);
}
