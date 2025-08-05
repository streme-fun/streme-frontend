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

interface AccountTokenSnapshot {
  totalNetFlowRate: string;
  totalInflowRate: string;
  totalOutflowRate: string;
  balanceUntilUpdatedAt: string;
  updatedAtTimestamp: string;
}

export function useStremeFlowRate() {
  const { address: wagmiAddress } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();
  const [flowRate, setFlowRate] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);

  // Get effective address based on mini-app or wallet connection
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  const fetchFlowRate = async () => {
    if (!effectiveAddress) {
      // No need to log - this is a normal state when not connected
      return;
    }
    console.log(
      "[useStremeFlowRate] Fetching flow rate for address:",
      effectiveAddress
    );
    setIsLoading(true);
    try {
      // STREME token address
      const stremeToken = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";

      // Query for total net flow rate from AccountTokenSnapshot
      const accountQuery = `
        query GetStremeFlowRate($accountId: ID!, $tokenId: String!) {
          account(id: $accountId) {
            accountTokenSnapshots(where: { token: $tokenId }) {
              totalNetFlowRate
              totalInflowRate
              totalOutflowRate
              balanceUntilUpdatedAt
              updatedAtTimestamp
            }
          }
        }
      `;

      const accountResponse = await fetch(
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: accountQuery,
            variables: {
              accountId: effectiveAddress.toLowerCase(),
              tokenId: stremeToken.toLowerCase(),
            },
          }),
        }
      );

      const accountData = await accountResponse.json();
      console.log(
        "[useStremeFlowRate] Account token snapshot response:",
        accountData
      );

      if (accountData.data?.account?.accountTokenSnapshots?.[0]) {
        const snapshot = accountData.data.account
          .accountTokenSnapshots[0] as AccountTokenSnapshot;
        const netFlowRate = BigInt(snapshot.totalNetFlowRate || "0");

        // Convert from wei/second to tokens/day
        const flowRatePerSecond = Number(formatUnits(netFlowRate, 18));
        const flowRatePerDay = flowRatePerSecond * 86400;
        const formattedFlowRate = flowRatePerDay.toFixed(4);

        console.log(
          "[useStremeFlowRate] Total net flow rate:",
          formattedFlowRate,
          "STREME/day"
        );
        setFlowRate(formattedFlowRate);
        return;
      }

      // Fallback to pool-based calculation if no account snapshot found
      console.log(
        "[useStremeFlowRate] No account snapshot found, falling back to pool calculation"
      );

      // STREME staking pool address
      const stakingPool = "0xa040a8564c433970d7919c441104b1d25b9eaa1c";
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
      console.log("[useStremeFlowRate] Pool subgraph response:", data);

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

          console.log(
            "[useStremeFlowRate] Calculated pool flow rate:",
            calculatedFlowRate,
            "STREME/day"
          );
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
