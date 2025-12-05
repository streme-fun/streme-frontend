"use client";

import { useState, useEffect } from "react";
import { publicClient } from "@/src/lib/viemClient";
import { formatEther } from "viem";

// Base network constants
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"; // Base Uniswap V3 Factory

// Uniswap V3 Factory ABI (minimal)
const UNISWAP_V3_FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    name: "getPool",
    outputs: [{ name: "pool", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface LiquidityInfo {
  poolAddress: string | null;
  wethBalance: bigint | null;
  wethBalanceFormatted: string | null;
  isLoading: boolean;
  error: string | null;
}

// Common fee tiers for Uniswap V3 (0.05%, 0.3%, 1%)
const COMMON_FEE_TIERS = [500, 3000, 10000];

export const useTokenLiquidity = (
  tokenAddress: string,
  poolAddress?: string
): LiquidityInfo => {
  const [liquidityInfo, setLiquidityInfo] = useState<LiquidityInfo>({
    poolAddress: null,
    wethBalance: null,
    wethBalanceFormatted: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!tokenAddress || tokenAddress === "0x") {
      setLiquidityInfo({
        poolAddress: null,
        wethBalance: null,
        wethBalanceFormatted: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    const fetchLiquidityInfo = async () => {
      setLiquidityInfo((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        let foundPool: string | null = null;
        let wethBalance: bigint | null = null;

        // If pool address is provided, use it directly
        if (
          poolAddress &&
          poolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          try {
            const balance = (await publicClient.readContract({
              address: WETH_ADDRESS as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [poolAddress as `0x${string}`],
            })) as bigint;

            foundPool = poolAddress;
            wethBalance = balance;

            const wethBalanceFormatted = wethBalance
              ? formatEther(wethBalance)
              : null;

            setLiquidityInfo({
              poolAddress: foundPool,
              wethBalance,
              wethBalanceFormatted,
              isLoading: false,
              error: null,
            });
            return;
          } catch (error) {
            console.warn("Failed to check provided pool address:", error);
            // Fall through to Uniswap pool search
          }
        }

        // Try different fee tiers to find the pool with the most liquidity
        for (const feeTier of COMMON_FEE_TIERS) {
          try {
            // Sort addresses to match Uniswap's token ordering
            const token0 =
              tokenAddress.toLowerCase() < WETH_ADDRESS.toLowerCase()
                ? tokenAddress
                : WETH_ADDRESS;
            const token1 =
              tokenAddress.toLowerCase() < WETH_ADDRESS.toLowerCase()
                ? WETH_ADDRESS
                : tokenAddress;

            const poolAddress = (await publicClient.readContract({
              address: UNISWAP_V3_FACTORY as `0x${string}`,
              abi: UNISWAP_V3_FACTORY_ABI,
              functionName: "getPool",
              args: [token0 as `0x${string}`, token1 as `0x${string}`, feeTier],
            })) as `0x${string}`;

            // Check if pool exists (non-zero address)
            if (
              poolAddress &&
              poolAddress !== "0x0000000000000000000000000000000000000000"
            ) {
              // Get WETH balance in this pool
              const balance = (await publicClient.readContract({
                address: WETH_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [poolAddress],
              })) as bigint;

              // If this pool has more WETH than our current best, use it
              if (!wethBalance || balance > wethBalance) {
                foundPool = poolAddress;
                wethBalance = balance;
              }
            }
          } catch (error) {
            console.warn(
              `Failed to check pool for fee tier ${feeTier}:`,
              error
            );
            // Continue to next fee tier
          }
        }

        const wethBalanceFormatted = wethBalance
          ? formatEther(wethBalance)
          : null;

        setLiquidityInfo({
          poolAddress: foundPool,
          wethBalance,
          wethBalanceFormatted,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error fetching liquidity info:", error);
        setLiquidityInfo({
          poolAddress: null,
          wethBalance: null,
          wethBalanceFormatted: null,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch liquidity info",
        });
      }
    };

    fetchLiquidityInfo();
  }, [tokenAddress, poolAddress]);

  return liquidityInfo;
};

// Helper function to determine if liquidity is low based on token age and WETH balance
export const isLiquidityLow = (
  wethBalance: bigint | null,
  tokenLaunchTime: string | number | Date,
  threshold: number = 0.001 // Default threshold: 0.02 WETH
): boolean => {
  const now = Date.now();
  const launchTime = new Date(tokenLaunchTime).getTime();
  if (!Number.isFinite(launchTime) || launchTime <= 0) {
    // Unknown launch time – skip warning until we have reliable data
    return false;
  }

  const hoursSinceLaunch = (now - launchTime) / (1000 * 60 * 60);
  if (hoursSinceLaunch < 0) {
    // Launch time in the future – treat as not yet launched
    return false;
  }

  // Only show warning for tokens launched over 1 hour ago
  if (hoursSinceLaunch < 1) return false;

  if (!wethBalance) return true;

  const wethBalanceNum = parseFloat(formatEther(wethBalance));
  return wethBalanceNum < threshold;
};
