"use client";

import { formatUnits } from "viem";
import { useState, useEffect, useMemo } from "react";
import { publicClient } from "@/src/lib/viemClient"; // Import the centralized client
import { useStreamingNumber } from "@/src/hooks/useStreamingNumber";
import { useWallet } from "@/src/hooks/useWallet";
import { useTokenPrice } from "@/src/hooks/useTokenPrice";
import {
  useTokenLiquidity,
  isLiquidityLow,
} from "@/src/hooks/useTokenLiquidity";

interface StakedBalanceProps {
  stakingAddress: string;
  stakingPool: string;
  symbol: string;
  tokenAddress: string;
  tokenLaunchTime: string | number | Date;
}

interface PoolData {
  totalUnits: string;
  flowRate: string;
  poolMembers: Array<{
    units: string;
  }>;
}

export function StakedBalance({
  stakingAddress,
  stakingPool,
  symbol,
  tokenAddress,
  tokenLaunchTime,
}: StakedBalanceProps) {
  const { address, isConnected } = useWallet();
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);
  const [poolPercentage, setPoolPercentage] = useState<string>("0");
  const [flowRate, setFlowRate] = useState<string>("0");
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Use centralized price cache
  const { price: tokenPrice } = useTokenPrice(tokenAddress, {
    refreshInterval: 300000, // 5 minutes
    autoRefresh: true,
  });

  // Use streaming number hook for animated balance
  const currentBalance = useStreamingNumber({
    baseAmount,
    flowRatePerSecond: Number(flowRate) / 86400, // Convert daily rate to per-second
    lastUpdateTime,
    updateInterval: 50, // 50ms for smooth animation (matches original)
    pauseWhenHidden: true,
  });

  const refresh = () => {
    // Debounce refresh calls to prevent rapid successive updates
    const now = Date.now();
    if (now - lastFetchTime < 1000) {
      console.log(
        "[StakedBalance] Ignoring refresh - too soon since last call"
      );
      return;
    }
    setRefreshTrigger((prev) => prev + 1);
  };

  // Main data fetching effect

  useEffect(() => {
    if (!isConnected || !address || !stakingAddress || !stakingPool) return;

    const fetchData = async () => {
      // Prevent calls if we just fetched data recently (within 30 seconds)
      const now = Date.now();
      if (now - lastFetchTime < 30000) {
        console.log("Skipping fetch - too soon since last fetch");
        return;
      }

      try {
        setLastFetchTime(now);
        console.log(
          `[StakedBalance] Fetching balance for ${address} at ${new Date(
            now
          ).toLocaleTimeString()}`
        );

        // Get staked balance
        const staked = await publicClient.readContract({
          address: stakingAddress as `0x${string}`,
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
          args: [address as `0x${string}`],
        });
        setStakedBalance(staked as bigint);

        // Get real-time received amount using token contract
        const received = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
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
          args: [address as `0x${string}`],
        });

        const formattedReceived = Number(formatUnits(received as bigint, 18));

        // Only update base amount and reset timer if the balance has actually changed
        // This prevents the streaming animation from restarting unnecessarily
        if (Math.abs(formattedReceived - baseAmount) > 0.0001) {
          setBaseAmount(formattedReceived);
          setLastUpdateTime(Date.now());
        }

        // Fetch pool data
        const query = `
          query PoolData {
            pool(id: "${stakingPool?.toLowerCase() || ""}") {
              totalUnits
              flowRate
              poolMembers(where: {account_: {id: "${
                address?.toLowerCase() || ""
              }"}}) {
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
        if (!data.data?.pool) return;

        const poolData = data.data.pool as PoolData;
        const member = poolData.poolMembers[0];

        if (member) {
          const totalUnits = BigInt(poolData.totalUnits || "0");
          const memberUnits = BigInt(member.units || "0");

          if (totalUnits > 0n) {
            const percentage = (Number(memberUnits) * 100) / Number(totalUnits);
            setPoolPercentage(percentage.toFixed(2));

            const totalFlowRate = Number(
              formatUnits(BigInt(poolData.flowRate), 18)
            );
            const userFlowRate = totalFlowRate * (percentage / 100);
            const flowRatePerDay = userFlowRate * 86400;
            setFlowRate(flowRatePerDay.toFixed(4));
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    // Only fetch if page is visible to reduce API calls when tab is inactive
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    fetchData();

    // Set up periodic refresh only if page is visible
    // Increased interval to 60 seconds to reduce API calls
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData();
      }
    }, 60000); // 60 seconds instead of 300 seconds

    // Listen for visibility changes to fetch fresh data when page becomes visible
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isConnected,
    address,
    stakingAddress,
    stakingPool,
    tokenAddress,
    refreshTrigger,
    // Note: Intentionally excluding baseAmount and lastFetchTime to prevent re-render loops
  ]);

  useEffect(() => {
    const element = document.querySelector("[data-staking-balance]");
    if (element) {
      element.addEventListener("refresh", refresh);
      return () => element.removeEventListener("refresh", refresh);
    }
  }, [refresh]);

  // Price is now handled by useTokenPrice hook

  // Use shared liquidity check (Uniswap V3 WETH reserves)
  const { wethBalance } = useTokenLiquidity(tokenAddress);
  const lowLiquidity = isLiquidityLow(wethBalance, tokenLaunchTime);

  // Calculate memoized values before early return
  const receivedUsdValue = useMemo(() => {
    if (!tokenPrice) return 0;
    return currentBalance * tokenPrice;
  }, [currentBalance, tokenPrice]);

  const formatUsd = useMemo(
    () => (value: number) => {
      if (value === 0) return "0.00";
      if (value < 1) return value.toFixed(4);
      if (value < 1000)
        return value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    []
  );

  // Don't render anything if wallet is not connected or address is missing
  if (!isConnected || !address) return null;

  const formattedBalance = Number(formatUnits(stakedBalance, 18)).toFixed(4);
  const formattedReceived = currentBalance.toFixed(4);

  return (
    <div
      data-staking-balance
      className="space-y-4 card bg-base-100 border border-base-300 p-4 relative z-10"
    >
      <div>
        <div className="text-sm opacity-60 mb-1">My Staked Balance</div>
        <div className="font-mono">
          {formattedBalance} st{symbol}
        </div>
      </div>
      <div>
        <div className="text-sm opacity-60 mb-1">My Amount Received</div>
        <div className="font-mono">
          {formattedReceived} {symbol}
        </div>
        {!lowLiquidity && tokenPrice && (
          <div className="text-xs text-base-content/50 font-mono mt-1">
            ${formatUsd(receivedUsdValue)}
          </div>
        )}
      </div>
      <div>
        <div className="text-sm opacity-60 mb-1">My Pool Share</div>
        <div className="font-mono">{poolPercentage}%</div>
      </div>
      <div>
        <div className="text-sm opacity-60 mb-1">My Flow Rate</div>
        <div className="font-mono">
          {flowRate} {symbol}/day
        </div>
      </div>
    </div>
  );
}
