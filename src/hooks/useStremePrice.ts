"use client";

import { useState, useEffect } from "react";

// interface PriceData {
//   usd: number;
// }

export const useStremePrice = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Use internal API route to avoid CSP issues
        const response = await fetch('/api/streme-price');
        
        if (!response.ok) {
          throw new Error('Failed to fetch price from API');
        }
        
        const data = await response.json();
        
        if (data.success && data.price) {
          setPrice(data.price);
          setError(null); // Clear any previous errors
        } else {
          throw new Error(data.error || 'Invalid price data');
        }
      } catch (err) {
        console.warn('Failed to fetch STREME price, using fallback:', err);
        setPrice(0.000012); // Mock price for development
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Refresh price every 5 minutes
    const interval = setInterval(fetchPrice, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const formatUsd = (stremeAmount: number): string => {
    if (!price) return '$0.00';
    const usdValue = stremeAmount * price;
    
    if (usdValue >= 1000000) {
      return `$${(usdValue / 1000000).toFixed(2)}M`;
    }
    if (usdValue >= 1000) {
      return `$${(usdValue / 1000).toFixed(2)}K`;
    }
    if (usdValue >= 1) {
      return `$${usdValue.toFixed(2)}`;
    }
    return `$${usdValue.toFixed(4)}`;
  };

  return {
    price,
    loading,
    error,
    formatUsd
  };
};