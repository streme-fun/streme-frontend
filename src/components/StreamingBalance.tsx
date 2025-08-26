"use client";

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import { useStreamingNumber } from "@/src/hooks/useStreamingNumber";
import { useTokenPrice } from "@/src/hooks/useTokenPrice";
import { useUnifiedWallet } from "@/src/hooks/useUnifiedWallet";
import { publicClient } from "@/src/lib/viemClient";
import { formatUnits } from "viem";

const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
const STREME_STAKING_POOL = "0xa040a8564c433970d7919c441104b1d25b9eaa1c";

interface StreamingBalanceProps {
  className?: string;
}

interface PoolData {
  totalUnits: string;
  flowRate: string;
  poolMembers: Array<{
    units: string;
  }>;
}

function StreamingBalanceComponent({ className = "" }: StreamingBalanceProps) {
  const { address: effectiveAddress, isConnected } = useUnifiedWallet();

  // State management (following StakedBalance pattern)
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [flowRate, setFlowRate] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(true);

  // Use centralized price cache
  const { price: stremePrice } = useTokenPrice(STREME_TOKEN_ADDRESS, {
    refreshInterval: 300000, // 5 minutes (much less aggressive)
    autoRefresh: true,
  });

  // Use refs to prevent effect dependency loops
  const lastFetchTimeRef = useRef(0);
  const baseAmountRef = useRef(baseAmount);

  // Update ref when baseAmount changes
  useEffect(() => {
    baseAmountRef.current = baseAmount;
  }, [baseAmount]);

  // Memoize flow rate calculation to prevent unnecessary recalculations
  const flowRatePerSecond = useMemo(() => {
    return Number(flowRate) / (86400 * 30); // Convert monthly rate to per-second
  }, [flowRate]);

  // Only animate when there's an active flow rate and the component is meaningful to display
  const shouldAnimate =
    flowRatePerSecond > 0 && (baseAmount > 0 || flowRatePerSecond > 0);

  // Use streaming number hook for animated balance (following StakedBalance pattern)
  const currentBalance = useStreamingNumber({
    baseAmount,
    flowRatePerSecond: shouldAnimate ? flowRatePerSecond : 0, // Pause animation when no flow
    lastUpdateTime,
    updateInterval: 100, // Optimized for better performance while maintaining smoothness
    pauseWhenHidden: true,
  });

  // Stable fetch function to prevent effect dependency loops
  const fetchData = useCallback(async () => {
    if (!effectiveAddress) return;

    // Prevent calls if we just fetched data recently (within 30 seconds)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 30000) {
      return;
    }

    try {
      lastFetchTimeRef.current = now;
      console.log(
        `[StreamingBalance] Fetching balance for ${effectiveAddress} at ${new Date(
          now
        ).toLocaleTimeString()}`
      );

      // Get STREME balance
      const balance = await publicClient.readContract({
        address: STREME_TOKEN_ADDRESS as `0x${string}`,
        abi: [
          {
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [effectiveAddress as `0x${string}`],
      });

      const formattedBalance = Number(formatUnits(balance as bigint, 18));

      // Only update base amount and reset timer if the balance has actually changed
      // This prevents the streaming animation from restarting unnecessarily
      if (Math.abs(formattedBalance - baseAmountRef.current) > 0.0001) {
        setBaseAmount(formattedBalance);
        setLastUpdateTime(Date.now());
      }

      // Fetch pool data to get flow rate (following StakedBalance pattern)
      const query = `
        query PoolData {
          pool(id: "${STREME_STAKING_POOL.toLowerCase()}") {
            totalUnits
            flowRate
            poolMembers(where: {account_: {id: "${effectiveAddress.toLowerCase()}"}}) {
              units
            }
          }
        }
      `;

      const response = await fetch(
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        }
      );

      const data = await response.json();
      if (!data.data?.pool) {
        setFlowRate("0");
        setIsLoading(false);
        return;
      }

      const poolData = data.data.pool as PoolData;
      const member = poolData.poolMembers[0];

      if (member) {
        const totalUnits = BigInt(poolData.totalUnits || "0");
        const memberUnits = BigInt(member.units || "0");

        if (totalUnits > 0n) {
          const percentage = (Number(memberUnits) * 100) / Number(totalUnits);
          const totalFlowRate = Number(
            formatUnits(BigInt(poolData.flowRate), 18)
          );
          const userFlowRate = totalFlowRate * (percentage / 100);
          const flowRatePerMonth = userFlowRate * 86400 * 30; // 30 days per month
          setFlowRate(flowRatePerMonth.toFixed(4));

          console.log(
            `[StreamingBalance] Flow rate calculated: ${flowRatePerMonth.toFixed(
              4
            )} STREME/month`
          );
        } else {
          setFlowRate("0");
        }
      } else {
        setFlowRate("0");
      }

      setIsLoading(false);
    } catch (error) {
      console.error("[StreamingBalance] Error fetching data:", error);
      setIsLoading(false);
    }
  }, [effectiveAddress]);

  // Main data fetching effect (optimized to prevent dependency loops)
  useEffect(() => {
    if (!effectiveAddress) return;

    // Only fetch if page is visible to reduce API calls when tab is inactive
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    fetchData();

    // Set up periodic refresh only if page is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData();
      }
    }, 60000); // 60 seconds

    // Listen for visibility changes to fetch fresh data when page becomes visible
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [effectiveAddress, fetchData]); // Only depend on address and stable fetchData

  // Price is now handled by useTokenPrice hook

  // Memoized calculations to prevent unnecessary rerenders
  const usdValue = useMemo(
    () => (stremePrice ? currentBalance * stremePrice : 0),
    [stremePrice, currentBalance]
  );

  const flowRatePerMonth = useMemo(() => parseFloat(flowRate) || 0, [flowRate]);

  // Memoized format function
  const formatBalance = useMemo(
    () => (value: number) => {
      if (value === 0) return "0.0000";
      if (value < 0.01) return value.toFixed(6);
      if (value < 1) return value.toFixed(4);
      if (value < 1000) return value.toFixed(4); // Show 4 decimals for STREME balance
      if (value < 1000000)
        return value.toLocaleString("en-US", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        });
      return `${(value / 1000000).toFixed(4)}M`; // Show 4 decimals even for millions
    },
    []
  );

  // Don't render anything if wallet is not connected or address is missing (following StakedBalance pattern)
  if (!isConnected || !effectiveAddress) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  // Only render if user has meaningful STREME data to display
  if (baseAmount === 0 && flowRatePerMonth === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <div className={`flex flex-col items-end ${className}`}>
        <div className="flex items-center gap-1">
          <span className="text-sm font-mono font-semibold text-primary">
            {formatBalance(currentBalance)}
          </span>
          <span className="text-xs text-base-content/70">STREME</span>
        </div>
        {stremePrice && (
          <div className="flex items-center gap-1 text-xs text-base-content/50 font-mono">
            <span>${formatBalance(usdValue)}</span>
            {flowRatePerMonth > 0 && (
              <span className="text-success">
                (+${(flowRatePerMonth * stremePrice).toFixed(2)}/mo)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoization comparison function - only re-render if props actually change
const arePropsEqual = (
  prevProps: StreamingBalanceProps,
  nextProps: StreamingBalanceProps
) => {
  return prevProps.className === nextProps.className;
};

// Export memoized component to prevent unnecessary rerenders
export const StreamingBalance = memo(StreamingBalanceComponent, arePropsEqual);
