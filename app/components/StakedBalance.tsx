"use client";

import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { useState, useEffect } from "react";

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL || "https://base.llamarpc.com"
  ),
});

interface StakedBalanceProps {
  stakingAddress: string;
  stakingPool: string;
  symbol: string;
  tokenAddress: string;
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
}: StakedBalanceProps) {
  const { user } = usePrivy();
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);
  const [poolPercentage, setPoolPercentage] = useState<string>("0");
  const [flowRate, setFlowRate] = useState<string>("0");
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [streamedAmount, setStreamedAmount] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => setRefreshTrigger((prev) => prev + 1);

  // Combine balance fetching and pool data into a single effect
  useEffect(() => {
    if (!user?.wallet?.address || !stakingAddress || !stakingPool) return;

    const fetchData = async () => {
      try {
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
          args: [user?.wallet?.address as `0x${string}`],
        });
        setStakedBalance(staked);

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
          args: [user?.wallet?.address as `0x${string}`],
        });

        const formattedReceived = Number(formatUnits(received, 18));
        console.log("Token balance:", formattedReceived);
        setBaseAmount(formattedReceived);
        setLastUpdateTime(Date.now());

        // Fetch pool data
        const query = `
          query PoolData {
            pool(id: "${stakingPool.toLowerCase()}") {
              totalUnits
              flowRate
              poolMembers(where: {account_: {id: "${user?.wallet?.address?.toLowerCase()}"}}) {
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

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [
    user?.wallet?.address,
    stakingAddress,
    stakingPool,
    tokenAddress,
    refreshTrigger,
  ]);

  // Separate animation effect for streaming
  useEffect(() => {
    const userFlowRate = Number(flowRate) / 86400;

    if (userFlowRate > 0) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - lastUpdateTime) / 1000;
        const newStreamed = userFlowRate * elapsed;
        console.log("Stream calculation:", {
          userFlowRate,
          elapsed,
          newStreamed,
          baseAmount,
        });
        setStreamedAmount(newStreamed);
      }, 50);
      return () => clearInterval(interval);
    } else {
      setStreamedAmount(0);
    }
  }, [flowRate, lastUpdateTime, baseAmount]);

  useEffect(() => {
    const element = document.querySelector("[data-staking-balance]");
    if (element) {
      element.addEventListener("refresh", refresh);
      return () => element.removeEventListener("refresh", refresh);
    }
  }, []);

  if (!user?.wallet?.address) return null;

  const formattedBalance = Number(formatUnits(stakedBalance, 18)).toFixed(4);
  const formattedReceived = (baseAmount + streamedAmount).toFixed(4);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm opacity-60 mb-1">My Staked Balance</div>
        <div className="font-mono text-lg">
          {formattedBalance} st{symbol}
        </div>
      </div>
      <div>
        <div className="text-sm opacity-60 mb-1">My Amount Received</div>
        <div className="font-mono text-lg">
          {formattedReceived} {symbol}
        </div>
      </div>
      <div>
        <div className="text-sm opacity-60 mb-1">My Pool Share</div>
        <div className="font-mono text-lg">{poolPercentage}%</div>
      </div>
      <div>
        <div className="text-sm opacity-60 mb-1">My Flow Rate</div>
        <div className="font-mono text-lg">
          {flowRate} {symbol}/day
        </div>
      </div>
    </div>
  );
}
