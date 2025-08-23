import { NextResponse } from "next/server";

interface Contributor {
  address: string;
  amount: string;
  username: string;
  pfp_url: string;
  percentage?: number;
}

// In-memory cache for leaderboard data (per contract)
const caches: Map<string, {
  data: Contributor[] | null;
  timestamp: number;
  isRefreshing: boolean;
}> = new Map();

// Get or create cache for a specific contract
function getCache(contractAddress: string = 'default') {
  if (!caches.has(contractAddress)) {
    caches.set(contractAddress, {
      data: null,
      timestamp: 0,
      isRefreshing: false,
    });
  }
  return caches.get(contractAddress)!;
}

// Cache duration: 5 minutes (significantly reduce external API calls)
const CACHE_DURATION = 5 * 60 * 1000;
// External API timeout: 5 seconds (fail fast to avoid gateway timeouts)
const API_TIMEOUT = 5 * 1000;
// Background refresh: Try to refresh cache before it expires
const CACHE_REFRESH_THRESHOLD = 4 * 60 * 1000; // Start trying to refresh at 4 minutes

// Background refresh function
async function refreshCacheInBackground(apiUrl: string, contractAddress: string = 'default') {
  const cache = getCache(contractAddress);
  
  // Don't refresh if already refreshing
  if (cache.isRefreshing) {
    console.log("Already refreshing in background, skipping...");
    return;
  }
  
  cache.isRefreshing = true;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const apiResponse = await fetch(
      apiUrl,
      {
        signal: controller.signal,
        next: { revalidate: 30 }
      }
    );
    
    clearTimeout(timeoutId);
    
    if (apiResponse.ok) {
      const data: Contributor[] = await apiResponse.json();
      const mergedContributors = mergeContributorsByUsername(data);
      const contributorsWithPercentages = calculatePercentages(mergedContributors);
      
      cache.data = contributorsWithPercentages;
      cache.timestamp = Date.now();
      
      console.log("Background refresh successful");
    }
  } catch (error) {
    console.log("Background refresh failed (will use existing cache):", error);
  } finally {
    cache.isRefreshing = false;
  }
}

export async function GET(request: Request) {
  // Check parameters at function level
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("force") === "true";
  const contractAddress = searchParams.get("contract");
  
  try {
    
    // Determine API endpoint based on contract address
    const getApiUrl = (contract?: string | null) => {
      if (!contract) {
        // Default to STREME contract
        contract = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b";
      }
      
      // Use the new crowdfund leaderboard endpoint structure
      return `https://api.streme.fun/api/crowdfund/leaderboard/${contract.toLowerCase()}`;
    };
    
    const apiUrl = getApiUrl(contractAddress);
    console.log(`Using API URL: ${apiUrl}`);
    
    const cache = getCache(contractAddress || 'default');
    const now = Date.now();
    const cacheAge = now - cache.timestamp;
    
    // Return cached data immediately if available and not forcing refresh
    if (!forceRefresh && cache.data) {
      if (cacheAge < CACHE_DURATION) {
        console.log(`Returning cached data (age: ${Math.round(cacheAge/1000)}s)`);
        
        // Try background refresh if cache is getting old
        if (cacheAge > CACHE_REFRESH_THRESHOLD) {
          console.log("Cache is old, attempting background refresh...");
          // Fire and forget background refresh (don't await)
          refreshCacheInBackground(apiUrl, contractAddress || 'default');
        }
        
        const response = NextResponse.json(cache.data);
        response.headers.set(
          "Cache-Control",
          "public, max-age=60, stale-while-revalidate=240"
        );
        return response;
      }
    }

    console.log("Fetching fresh contributors from external API...");
    
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    try {
      const apiResponse = await fetch(
        apiUrl,
        {
          signal: controller.signal,
          // Allow Next.js to cache for 30 seconds
          next: { revalidate: 30 }
        }
      );
      
      clearTimeout(timeoutId);
      console.log("Contributors API response status:", apiResponse.status);

      if (apiResponse.ok) {
        const data: Contributor[] = await apiResponse.json();
        
        // Merge contributors with the same username
        const mergedContributors = mergeContributorsByUsername(data);
        
        // Calculate percentages
        const contributorsWithPercentages = calculatePercentages(mergedContributors);
        
        // Update cache
        cache.data = contributorsWithPercentages;
        cache.timestamp = now;
        cache.isRefreshing = false;
        
        const response = NextResponse.json(contributorsWithPercentages);
        // Set cache headers to allow browser caching
        response.headers.set(
          "Cache-Control",
          "public, max-age=30, stale-while-revalidate=60"
        );
        
        return response;
      } else {
        console.error("Contributors API failed with status:", apiResponse.status);
        
        // If we have cached data, return it even if stale (better than error)
        if (cache.data) {
          console.log("Returning stale cache due to API error");
          const response = NextResponse.json(cache.data);
          response.headers.set(
            "Cache-Control",
            "public, max-age=10, stale-while-revalidate=30"
          );
          return response;
        }
        
        return NextResponse.json(
          { error: "Failed to fetch contributors" },
          { status: apiResponse.status }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if ((error as Error).name === 'AbortError') {
        console.error(`External API timeout after ${API_TIMEOUT/1000} seconds`);
        
        // Always return cached data if available on timeout (even if stale)
        const timeoutCache = getCache(contractAddress || 'default');
        if (timeoutCache.data) {
          console.log("Returning stale cache due to timeout");
          const response = NextResponse.json(timeoutCache.data);
          response.headers.set(
            "Cache-Control",
            "public, max-age=60, stale-while-revalidate=240"
          );
          return response;
        }
        
        // Return empty array instead of error if no cache
        console.log("No cache available, returning empty array");
        return NextResponse.json([]);
      }
      
      throw error;
    }
  } catch (error) {
    console.error("Error fetching contributors:", error);
    
    // Last resort: return cached data if available
    const errorCache = getCache(contractAddress || 'default');
    if (errorCache.data) {
      console.log("Returning stale cache due to error");
      const response = NextResponse.json(errorCache.data);
      response.headers.set(
        "Cache-Control",
        "public, max-age=10, stale-while-revalidate=30"
      );
      return response;
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function mergeContributorsByUsername(
  contributors: Contributor[]
): Contributor[] {
  const mergedMap = new Map<string, Contributor>();

  contributors.forEach((contributor) => {
    const key = contributor.username || contributor.address;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      // Add amounts together (both are strings representing BigInt values)
      const existingAmount = BigInt(existing.amount);
      const newAmount = BigInt(contributor.amount);
      const totalAmount = existingAmount + newAmount;

      mergedMap.set(key, {
        ...existing,
        amount: totalAmount.toString(),
        // Keep the first address encountered, or prefer the one with username if merging by username
        address: contributor.username ? existing.address : contributor.address,
      });
    } else {
      mergedMap.set(key, { ...contributor });
    }
  });

  return Array.from(mergedMap.values());
}

function calculatePercentages(contributors: Contributor[]): Contributor[] {
  // Calculate total amount
  const totalAmount = contributors.reduce((sum, contributor) => {
    return sum + BigInt(contributor.amount);
  }, BigInt(0));

  // If no total, return as is
  if (totalAmount === BigInt(0)) {
    return contributors.map((c) => ({ ...c, percentage: 0 }));
  }

  // Calculate percentage for each contributor
  return contributors.map((contributor) => {
    const contributorAmount = BigInt(contributor.amount);
    const percentage =
      Number((contributorAmount * BigInt(10000)) / totalAmount) / 100; // Calculate with 2 decimal precision

    return {
      ...contributor,
      percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
    };
  });
}