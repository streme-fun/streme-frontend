"use client";

import { useState } from "react";
import { useTokenPrice } from "@/src/hooks/useTokenPrice";

export function usePriceData(tokenAddress: string) {
  const [baseUsdValue, setBaseUsdValue] = useState<number>(0);
  const [lastUsdUpdateTime, setLastUsdUpdateTime] = useState<number>(
    Date.now()
  );

  // Use centralized price cache
  const { price } = useTokenPrice(tokenAddress, {
    refreshInterval: 300000, // 5 minutes
    autoRefresh: true,
  });

  return {
    price,
    baseUsdValue,
    setBaseUsdValue,
    lastUsdUpdateTime,
    setLastUsdUpdateTime,
  };
}