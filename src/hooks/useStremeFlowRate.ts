"use client";

import { useState, useEffect } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "./useAppFrameLogic";

interface PoolData {
  totalUnits: string;
  flowRate: string;
  poolMembers: Array<{
    units: string;
  }>;
}

export function useStremeFlowRate() {
  const { address: wagmiAddress } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();
  const [flowRate, setFlowRate] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);

  // Get effective address based on mini-app or wallet connection
  const effectiveAddress = isMiniAppView 
    ? fcAddress 
    : wagmiAddress;

  const fetchFlowRate = async () => {
    if (!effectiveAddress) {
      console.log("[useStremeFlowRate] No address available");
      return;
    }
    console.log("[useStremeFlowRate] Fetching flow rate for address:", effectiveAddress);
    setIsLoading(true);
    try {
      // STREME staking pool address
      const stakingPool = "0xcbc2caf425f8cdca774128b3d14de37f2224b964";
      console.log("[useStremeFlowRate] Using staking pool:", stakingPool);

      const query = `
        query PoolData {
          pool(id: "${stakingPool?.toLowerCase() || ""}") {
            totalUnits
            flowRate
            poolMembers(where: {account_: {id: "${
              effectiveAddress?.toLowerCase() || ""
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
      console.log("[useStremeFlowRate] Subgraph response:", data);
      
      if (!data.data?.pool) {
        console.log("[useStremeFlowRate] No pool data found");
        setFlowRate("0");
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
          const flowRatePerDay = userFlowRate * 86400;
          const calculatedFlowRate = flowRatePerDay.toFixed(4);
          
          console.log("[useStremeFlowRate] Calculated flow rate:", calculatedFlowRate, "STREME/day");
          setFlowRate(calculatedFlowRate);
        } else {
          console.log("[useStremeFlowRate] Total units is 0");
          setFlowRate("0");
        }
      } else {
        console.log("[useStremeFlowRate] User is not a pool member");
        setFlowRate("0");
      }
    } catch (error) {
      console.error("[useStremeFlowRate] Error fetching flow rate:", error);
      setFlowRate("0");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowRate();
  }, [effectiveAddress]);

  // Return the fetch function so it can be called manually
  return { flowRate, isLoading, refetch: fetchFlowRate };
}