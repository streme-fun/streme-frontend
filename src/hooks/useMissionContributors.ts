"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { STREME_STAKING_REWARDS_FUNDER_ADDRESS, STREME_STAKING_REWARDS_FUNDER_ABI } from "@/src/lib/contracts/StremeStakingRewardsFunder";
import { formatUnits } from "viem";

interface FarcasterUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

interface ContributorData {
  address: string;
  balance: bigint;
  farcasterUser?: FarcasterUser;
  rank: number;
  percentage: number;
}

export const useMissionContributors = () => {
  const [contributors, setContributors] = useState<ContributorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get total balance to calculate percentages
  const { data: totalBalance } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "totalBalance",
  });

  // In production, fetch these from contract Deposit events
  // For demo, using a few addresses to check if they have real balances
  const mockContributorAddresses: string[] = [
    "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e",
    "0x1234567890123456789012345678901234567890"
  ];

  // Read balances for each contributor from the contract
  const balance1 = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "balanceOf",
    args: [mockContributorAddresses[0] as `0x${string}`],
  });
  
  const balance2 = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "balanceOf",
    args: [mockContributorAddresses[1] as `0x${string}`],
  });
  
  // const balance3 = useReadContract({
  //   address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
  //   abi: STREME_STAKING_REWARDS_FUNDER_ABI,
  //   functionName: "balanceOf",
  //   args: [mockContributorAddresses[2] as `0x${string}`],
  // });
  
  // const balanceQueries = [balance1, balance2, balance3, balance4, balance5];

  // Fetch Farcaster data for addresses
  const fetchFarcasterData = async (address: string): Promise<FarcasterUser | undefined> => {
    try {
      // In production, you would:
      // 1. Use Neynar API to search for users by connected ETH address
      // 2. The search would use endpoints like /v2/farcaster-user/by-verification
      // 3. Handle the response to extract fid, username, display_name, pfp_url
      
      // For development, using realistic mock data based on common Farcaster patterns
      const mockFarcasterUsers: Record<string, FarcasterUser> = {
        "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e": {
          fid: 12345,
          username: "streamer1",
          display_name: "Top Streamer",
          pfp_url: "/api/placeholder/40/40"
        },
        "0x1234567890123456789012345678901234567890": {
          fid: 23456,
          username: "defi_builder", 
          display_name: "DeFi Builder",
          pfp_url: "/api/placeholder/40/40"
        },
        "0x4567890123456789012345678901234567890123": {
          fid: 45678,
          username: "community_lead",
          display_name: "Community Leader", 
          pfp_url: "/api/placeholder/40/40"
        }
      };
      
      return mockFarcasterUsers[address];
    } catch (err) {
      console.warn(`Failed to fetch Farcaster data for ${address}:`, err);
      return undefined;
    }
  };

  useEffect(() => {
    const processContributors = async () => {
      try {
        setLoading(true);
        
        // Wait for all balance queries to complete
        const balances = [balance1.data, balance2.data];
        
        if (!totalBalance || balances.some(b => b === undefined)) {
          return; // Still loading
        }

        // Create contributor data with balances and Farcaster profiles
        const contributorPromises = mockContributorAddresses.map(async (address, index) => {
          const balance = balances[index] as bigint;
          
          // Use actual balance from contract, no mock data
          const finalBalance = balance || 0n;
          const farcasterUser = await fetchFarcasterData(address);
          
          const percentage = totalBalance && totalBalance > 0n ? 
            (Number(finalBalance) / Number(totalBalance)) * 100 : 
            0;

          return {
            address,
            balance: finalBalance,
            farcasterUser,
            rank: 0, // Will be set after sorting
            percentage
          };
        });

        const contributorData = await Promise.all(contributorPromises);
        
        // Filter out zero balances and sort by balance
        const filteredAndSorted = contributorData
          .filter(c => c.balance > 0n)
          .sort((a, b) => Number(b.balance - a.balance))
          .map((contributor, index) => ({
            ...contributor,
            rank: index + 1
          }));

        setContributors(filteredAndSorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    processContributors();
  }, [totalBalance, balance1.data, balance2.data]);

  const formatContribution = (balance: bigint): string => {
    const formatted = formatUnits(balance, 18);
    const num = parseFloat(formatted);
    
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  return {
    contributors,
    loading,
    error,
    totalBalance,
    formatContribution
  };
};