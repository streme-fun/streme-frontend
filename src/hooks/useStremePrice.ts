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
        // Using CoinGecko API to get STREME price
        // Contract address: 0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58&vs_currencies=usd'
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch price');
        }
        
        const data = await response.json();
        const priceData = data['0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58'];
        
        if (priceData && priceData.usd) {
          setPrice(priceData.usd);
        } else {
          // Fallback to mock price if API doesn't have data yet
          setPrice(0.000012); // Mock price for development
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