"use client";

import { useState, useEffect } from "react";
import { getPrices } from "@/src/lib/priceUtils";

export function usePriceData(tokenAddress: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [baseUsdValue, setBaseUsdValue] = useState<number>(0);
  const [lastUsdUpdateTime, setLastUsdUpdateTime] = useState<number>(
    Date.now()
  );

  // Fetch token price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const prices = await getPrices([tokenAddress]);
        if (prices) {
          const tokenPrice = prices[tokenAddress.toLowerCase()];
          if (tokenPrice && typeof tokenPrice === 'object' && 'usd' in tokenPrice) {
            setPrice((tokenPrice as { usd: number }).usd);
          } else if (typeof tokenPrice === 'number') {
            setPrice(tokenPrice);
          }
        }
      } catch (error) {
        console.error("Error fetching token price:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [tokenAddress]);

  return {
    price,
    baseUsdValue,
    setBaseUsdValue,
    lastUsdUpdateTime,
    setLastUsdUpdateTime,
  };
}