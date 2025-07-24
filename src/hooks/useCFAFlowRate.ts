"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "./useAppFrameLogic";
import { flowRateToTokensPerDay, STREME_SUPER_TOKEN } from "@/src/lib/superfluid-cfa";

interface AccountTokenSnapshot {
  totalNetFlowRate: string;
  totalInflowRate: string;
  totalOutflowRate: string;
  balanceUntilUpdatedAt: string;
  updatedAtTimestamp: string;
}

/**
 * Hook to get the user's net flow rate (incoming - outgoing) for STREME tokens
 */
export function useCFAFlowRate() {
  const { address: wagmiAddress } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();
  const [flowRatePerDay, setFlowRatePerDay] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);

  // Get effective address based on mini-app or wallet connection
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  const fetchCFAFlowRate = async () => {
    if (!effectiveAddress) {
      console.log("[useCFAFlowRate] No address available");
      return;
    }
    
    console.log("[useCFAFlowRate] Fetching CFA flow rate for address:", effectiveAddress);
    setIsLoading(true);
    
    try {
      // Query for account token snapshot to get net flow rate
      const query = `
        query GetAccountTokenSnapshot($account: String!, $token: String!) {
          accountTokenSnapshots(
            where: {
              account: $account,
              token: $token
            }
          ) {
            totalNetFlowRate
            totalInflowRate
            totalOutflowRate
            balanceUntilUpdatedAt
            updatedAtTimestamp
          }
        }
      `;

      const variables = {
        account: effectiveAddress.toLowerCase(),
        token: STREME_SUPER_TOKEN.toLowerCase()
      };

      console.log("[useCFAFlowRate] Query:", query);
      console.log("[useCFAFlowRate] Variables:", variables);

      const response = await fetch(
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            variables,
          }),
        }
      );

      const data = await response.json();
      console.log("[useCFAFlowRate] Subgraph response:", data);

      if (data.data?.accountTokenSnapshots && data.data.accountTokenSnapshots.length > 0) {
        const snapshot: AccountTokenSnapshot = data.data.accountTokenSnapshots[0];
        
        // Convert net flow rate from wei/second to tokens/day
        const netFlowRatePerDay = flowRateToTokensPerDay(BigInt(snapshot.totalNetFlowRate));
        const inflowRatePerDay = flowRateToTokensPerDay(BigInt(snapshot.totalInflowRate));
        const outflowRatePerDay = flowRateToTokensPerDay(BigInt(snapshot.totalOutflowRate));
        
        console.log("[useCFAFlowRate] Flow rates:", {
          netFlowRate: `${netFlowRatePerDay} STREME/day`,
          inflowRate: `${inflowRatePerDay} STREME/day`,
          outflowRate: `${outflowRatePerDay} STREME/day`
        });
        
        setFlowRatePerDay(netFlowRatePerDay.toFixed(4));
      } else {
        console.log("[useCFAFlowRate] No account token snapshot found");
        setFlowRatePerDay("0");
      }
    } catch (error) {
      console.error("[useCFAFlowRate] Error fetching CFA flow rate:", error);
      setFlowRatePerDay("0");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCFAFlowRate();
  }, [effectiveAddress]);

  // Return the fetch function so it can be called manually
  return { flowRate: flowRatePerDay, isLoading, refetch: fetchCFAFlowRate };
}