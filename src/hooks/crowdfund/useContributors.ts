"use client";

import { useState, useEffect, useCallback } from "react";
import { CrowdfundToken } from "@/src/lib/crowdfundTokens";

interface Contributor {
  address: string;
  amount: string;
  username: string;
  pfp_url: string;
  percentage?: number;
}

export function useContributors(
  tokenAddress: string,
  tokenConfig: CrowdfundToken | undefined,
  triggerRefresh: boolean = false
) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [isLoadingContributors, setIsLoadingContributors] = useState(true);

  const fetchContributors = useCallback(
    async (forceRefresh = false) => {
      console.log(
        `[fetchContributors] Starting fetch, forceRefresh=${forceRefresh}, tokenAddress=${tokenAddress}`
      );
      setIsLoadingContributors(true);

      // Use the crowdfund contract address from tokenConfig or fallback
      const contractAddress =
        tokenConfig?.depositContractAddress ||
        "0xceaCfbB5A17b6914051D12D8c91d3461382d503b";
      const params = new URLSearchParams({ contract: contractAddress });
      if (forceRefresh) {
        params.append("force", "true");
      }
      const url = `/api/crowdfund/leaderboard?${params.toString()}`;

      try {
        const response = await fetch(url, {
          // Allow browser caching when not forcing refresh
          cache: forceRefresh ? "no-cache" : "default",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(
          `[fetchContributors] Received ${data.contributors?.length || 0} contributors`
        );

        if (data.contributors && Array.isArray(data.contributors)) {
          setContributors(data.contributors);
        } else {
          console.error(
            "[fetchContributors] Invalid data format:",
            data
          );
          setContributors([]);
        }
      } catch (error) {
        console.error("[fetchContributors] Error fetching:", error);
        setContributors([]);
      } finally {
        setIsLoadingContributors(false);
      }
    },
    [tokenAddress, tokenConfig?.depositContractAddress]
  );

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchContributors();
    const interval = setInterval(() => fetchContributors(false), 30000);
    return () => clearInterval(interval);
  }, [fetchContributors]);

  // Handle manual refresh
  useEffect(() => {
    if (triggerRefresh) {
      fetchContributors(true);
    }
  }, [triggerRefresh, fetchContributors]);

  return {
    contributors,
    isLoadingContributors,
    refetchContributors: fetchContributors,
  };
}