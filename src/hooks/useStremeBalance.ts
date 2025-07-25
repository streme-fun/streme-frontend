"use client";

import { useState, useEffect } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "./useAppFrameLogic";
import { publicClient } from "../lib/viemClient";
import { useStreamingNumber } from "./useStreamingNumber";

export function useStremeBalance() {
  const { address: wagmiAddress } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [flowRatePerDay, setFlowRatePerDay] = useState<number>(0);

  // Get effective address based on mini-app or wallet connection
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  // STREME token address
  const STREME_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";

  const fetchBalance = async () => {
    if (!effectiveAddress) {
      console.log("[useStremeBalance] No address available");
      return;
    }

    setIsLoading(true);
    try {
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
      
      // Only update if balance has changed significantly
      if (Math.abs(formattedBalance - baseAmount) > 0.0001) {
        setBaseAmount(formattedBalance);
        setLastUpdateTime(Date.now());
      }
    } catch (error) {
      console.error("[useStremeBalance] Error fetching balance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set flow rate when it changes
  const updateFlowRate = (rate: string) => {
    const newRate = parseFloat(rate) || 0;
    console.log("[useStremeBalance] Updating flow rate:", newRate);
    setFlowRatePerDay(newRate);
    // Also update the timestamp to trigger balance animation
    setLastUpdateTime(Date.now());
  };

  useEffect(() => {
    fetchBalance();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [effectiveAddress]);

  // Use streaming number hook for animated balance
  const currentBalance = useStreamingNumber({
    baseAmount,
    flowRatePerSecond: flowRatePerDay / 86400, // Convert daily rate to per-second
    lastUpdateTime,
    updateInterval: 16, // ~60fps for smooth animation
    pauseWhenHidden: true,
  });

  return { 
    balance: currentBalance, 
    isLoading,
    refetch: fetchBalance,
    updateFlowRate
  };
}