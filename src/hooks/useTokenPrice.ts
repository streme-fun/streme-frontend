"use client";

import { useState, useEffect, useRef } from 'react';
import { priceCache } from '@/src/lib/priceCache';

interface UseTokenPriceOptions {
  /** How often to check for updates (default: 60000ms = 1 minute) */
  refreshInterval?: number;
  /** Whether to enable automatic refresh (default: true) */
  autoRefresh?: boolean;
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
}

interface TokenPriceResult {
  price: number | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and caching token prices
 * Uses centralized price cache to avoid duplicate API calls
 */
export function useTokenPrice(
  tokenAddress: string | undefined,
  options: UseTokenPriceOptions = {}
): TokenPriceResult {
  const {
    refreshInterval = 60000, // 1 minute
    autoRefresh = true,
    immediate = true,
  } = options;

  const [price, setPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchPrice = async (force = false) => {
    if (!tokenAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const priceData = force 
        ? await priceCache.refreshPrice(tokenAddress)
        : await priceCache.getPrice(tokenAddress);

      if (!mountedRef.current) return;

      if (priceData) {
        setPrice(priceData.price);
        setLastUpdated(priceData.timestamp);
      } else {
        setPrice(null);
        setError('Failed to fetch price');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error(`Error fetching price for ${tokenAddress}:`, err);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const refresh = async () => {
    await fetchPrice(true);
  };

  // Initial fetch
  useEffect(() => {
    if (immediate && tokenAddress) {
      fetchPrice();
    }
  }, [tokenAddress, immediate]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !tokenAddress) return;

    intervalRef.current = setInterval(() => {
      fetchPrice();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tokenAddress, autoRefresh, refreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    price,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}

/**
 * Hook for fetching multiple token prices
 */
export function useTokenPrices(
  tokenAddresses: string[],
  options: UseTokenPriceOptions = {}
): {
  prices: Map<string, number | null>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
} {
  const {
    refreshInterval = 60000,
    autoRefresh = true,
    immediate = true,
  } = options;

  const [prices, setPrices] = useState<Map<string, number | null>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchPrices = async () => {
    if (tokenAddresses.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const priceResults = await priceCache.getPrices(tokenAddresses);
      
      if (!mountedRef.current) return;

      const newPrices = new Map<string, number | null>();
      let latestTimestamp = 0;

      priceResults.forEach((priceData, address) => {
        if (priceData) {
          newPrices.set(address, priceData.price);
          latestTimestamp = Math.max(latestTimestamp, priceData.timestamp);
        } else {
          newPrices.set(address, null);
        }
      });

      setPrices(newPrices);
      if (latestTimestamp > 0) {
        setLastUpdated(latestTimestamp);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching multiple prices:', err);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const refresh = async () => {
    await fetchPrices();
  };

  // Initial fetch
  useEffect(() => {
    if (immediate && tokenAddresses.length > 0) {
      fetchPrices();
    }
  }, [JSON.stringify(tokenAddresses.sort()), immediate]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || tokenAddresses.length === 0) return;

    intervalRef.current = setInterval(() => {
      fetchPrices();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [JSON.stringify(tokenAddresses.sort()), autoRefresh, refreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    prices,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}