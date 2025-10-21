"use client";

import { useCallback, useEffect, useState } from "react";
import { STREME_VAULT, STREME_VAULT_ABI } from "@/src/lib/contracts";
import { publicClient } from "@/src/lib/viemClient";

export interface VaultAllocationInfo {
  tokenAddress: `0x${string}`;
  amountTotal: bigint;
  amountClaimed: bigint;
  lockupEndTime: number;
  vestingEndTime: number;
  allocationAdmin: `0x${string}`;
  pool: `0x${string}`;
  box: `0x${string}`;
}

interface VaultAllocationState {
  data: VaultAllocationInfo | null;
  isLoading: boolean;
  error: string | null;
}

const parseAllocationResult = (
  result:
    | readonly [
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`
      ]
    | undefined
): VaultAllocationInfo | null => {
  if (!result) {
    return null;
  }

  const [
    tokenAddress,
    amountTotal,
    amountClaimed,
    lockupEnd,
    vestingEnd,
    allocationAdmin,
    pool,
    box,
  ] = result;

  return {
    tokenAddress,
    amountTotal,
    amountClaimed,
    lockupEndTime: Number(lockupEnd),
    vestingEndTime: Number(vestingEnd),
    allocationAdmin,
    pool,
    box,
  };
};

export function useVaultAllocation(
  tokenAddress?: string,
  adminAddress?: string
): VaultAllocationState & {
  refetch: () => Promise<VaultAllocationInfo | null>;
} {
  const [state, setState] = useState<VaultAllocationState>({
    data: null,
    isLoading: false,
    error: null,
  });

  const readAllocation = useCallback(async () => {
    if (!tokenAddress || !adminAddress) {
      return null;
    }

    const response = await publicClient.readContract({
      address: STREME_VAULT as `0x${string}`,
      abi: STREME_VAULT_ABI,
      functionName: "allocation",
      args: [tokenAddress as `0x${string}`, adminAddress as `0x${string}`],
    });

    return parseAllocationResult(
      response as readonly [
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`
      ]
    );
  }, [tokenAddress, adminAddress]);

  useEffect(() => {
    let isActive = true;

    const fetchAllocation = async () => {
      if (!tokenAddress || !adminAddress) {
        if (isActive) {
          setState({
            data: null,
            isLoading: false,
            error: null,
          });
        }
        return;
      }

      if (isActive) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        const data = await readAllocation();
        if (isActive) {
          setState({
            data: data ?? null,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch vault allocation:", error);
        if (isActive) {
          setState({
            data: null,
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load vault allocation",
          });
        }
      }
    };

    fetchAllocation();

    return () => {
      isActive = false;
    };
  }, [tokenAddress, adminAddress, readAllocation]);

  const refetch = useCallback(async () => {
    if (!tokenAddress || !adminAddress) {
      setState({
        data: null,
        isLoading: false,
        error: null,
      });
      return null;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await readAllocation();
      setState({
        data: data ?? null,
        isLoading: false,
        error: null,
      });
      return data ?? null;
    } catch (error) {
      console.error("Failed to refetch vault allocation:", error);
      setState({
        data: null,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh vault allocation",
      });
      throw error;
    }
  }, [tokenAddress, adminAddress, readAllocation]);

  return {
    ...state,
    refetch,
  };
}
