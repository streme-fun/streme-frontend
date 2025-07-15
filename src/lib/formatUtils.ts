/**
 * Basic formatting utilities for displaying market data
 */

// Format market cap with K/M abbreviations
export const formatMarketCap = (marketCap: number | undefined): string => {
  if (!marketCap) return "-";

  if (marketCap >= 1000000) {
    return `$${(marketCap / 1000000).toFixed(1)}M`;
  } else if (marketCap >= 1000) {
    return `$${(marketCap / 1000).toFixed(1)}K`;
  } else {
    return `$${marketCap.toFixed(0)}`;
  }
};

// Format 24h change percentage with color indicators
export const format24hChange = (change24h: number | undefined): { 
  formatted: string; 
  isPositive: boolean | null;
} => {
  if (change24h === undefined) return { formatted: "-", isPositive: null };
  
  const isPositive = change24h >= 0;
  const formatted = `${isPositive ? "+" : ""}${change24h.toFixed(2)}%`;
  
  return { formatted, isPositive };
};