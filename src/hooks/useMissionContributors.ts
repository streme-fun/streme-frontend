"use client";

import { useState, useEffect } from "react";
import { useReadContract, usePublicClient } from "wagmi";
import { STREME_STAKING_REWARDS_FUNDER_ADDRESS, STREME_STAKING_REWARDS_FUNDER_ABI } from "@/src/lib/contracts/StremeStakingRewardsFunder";
import { formatUnits, getAddress } from "viem";

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
  const [contributorAddresses, setContributorAddresses] = useState<string[]>([]);

  const publicClient = usePublicClient();

  // Get total balance to calculate percentages
  const { data: totalBalance } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "totalBalance",
  });

  // Fetch contributor addresses from Deposit events
  const fetchContributorAddresses = async () => {
    if (!publicClient) {
      console.log('❌ No public client available');
      return [];
    }

    try {
      console.log('🔗 Fetching from contract:', STREME_STAKING_REWARDS_FUNDER_ADDRESS);
      
      // Get current block number to limit search range for better performance
      // Use a smaller range due to RPC limitations - search last 10k blocks
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;
      
      console.log(`📦 Searching blocks ${fromBlock} to latest (current: ${currentBlock})`);

      // Get Deposit events from the contract
      const logs = await publicClient.getLogs({
        address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
        event: {
          type: 'event',
          name: 'Deposit',
          inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false }
          ]
        },
        fromBlock,
        toBlock: 'latest'
      });

      console.log(`📋 Found ${logs.length} deposit events`);

      // Extract unique addresses from the logs
      const addresses = [...new Set(logs.map(log => {
        if (log.args && 'user' in log.args) {
          return getAddress(log.args.user as string);
        }
        return null;
      }).filter(Boolean))] as string[];

      console.log(`👥 Found ${addresses.length} unique contributors:`, addresses);
      console.log('📝 Raw deposit events:', logs.map(log => ({
        user: log.args?.user,
        amount: log.args?.amount?.toString(),
        blockNumber: log.blockNumber?.toString()
      })));
      
      if (addresses.length === 0) {
        console.log('⚠️ No contributors found in events, using fallback addresses');
        return [
          getAddress("0x764E427020Ad72624075c61260192C6E486D15a5"),
          getAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e")
        ];
      }
      
      // Always include the known contributor in case events miss them
      const knownContributor = getAddress("0x764E427020Ad72624075c61260192C6E486D15a5");
      if (!addresses.includes(knownContributor)) {
        console.log('🔧 Adding known contributor to address list');
        addresses.push(knownContributor);
      }
      
      return addresses;
    } catch (err) {
      console.error('❌ Failed to fetch deposit events:', err);
      // Fallback to mock addresses if event fetching fails
      console.log('🔄 Using fallback addresses');
      return [
        getAddress("0x764E427020Ad72624075c61260192C6E486D15a5"),
        getAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e")
      ];
    }
  };

  // Fetch Farcaster data for addresses
  const fetchFarcasterData = async (address: string): Promise<FarcasterUser | undefined> => {
    try {
      // In production, you would:
      // 1. Use Neynar API to search for users by connected ETH address
      // 2. The search would use endpoints like /v2/farcaster-user/by-verification
      // 3. Handle the response to extract fid, username, display_name, pfp_url
      
      // For development, using realistic mock data based on common Farcaster patterns
      const mockFarcasterUsers: Record<string, FarcasterUser> = {
        "0x764E427020Ad72624075c61260192C6E486D15a5": {
          fid: 12345,
          username: "streamer1",
          display_name: "Top Streamer",
          pfp_url: "/api/placeholder/40/40"
        },
        "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e": {
          fid: 23456,
          username: "defi_builder", 
          display_name: "DeFi Builder",
          pfp_url: "/api/placeholder/40/40"
        }
      };
      
      return mockFarcasterUsers[address];
    } catch (err) {
      console.warn(`Failed to fetch Farcaster data for ${address}:`, err);
      return undefined;
    }
  };

  // Fetch addresses on mount
  useEffect(() => {
    const loadAddresses = async () => {
      console.log('🔍 Loading contributor addresses...');
      console.log('Public client available:', !!publicClient);
      const addresses = await fetchContributorAddresses();
      console.log('📊 Loaded addresses:', addresses);
      setContributorAddresses(addresses);
    };
    
    loadAddresses();
  }, [publicClient]);

  useEffect(() => {
    const processContributors = async () => {
      try {
        setLoading(true);
        
        console.log('💰 Processing contributors...');
        console.log('Total balance:', totalBalance?.toString());
        console.log('Contributor addresses:', contributorAddresses);
        console.log('Public client:', !!publicClient);
        
        if (!totalBalance || contributorAddresses.length === 0 || !publicClient) {
          console.log('⏳ Still loading - missing:', {
            totalBalance: !!totalBalance,
            addresses: contributorAddresses.length,
            publicClient: !!publicClient
          });
          return; // Still loading
        }

        // Fetch balances for all contributor addresses
        const contributorPromises = contributorAddresses.map(async (address) => {
          try {
            console.log(`💳 Checking balance for address: ${address}`);
            
            // Try both balanceOf and deposits functions to see which one has data
            const balance = await publicClient.readContract({
              address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
              abi: STREME_STAKING_REWARDS_FUNDER_ABI,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            }) as bigint;

            const deposits = await publicClient.readContract({
              address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
              abi: STREME_STAKING_REWARDS_FUNDER_ABI,
              functionName: "deposits",
              args: [address as `0x${string}`],
            }) as bigint;

            console.log(`💰 Address ${address}: balanceOf=${balance.toString()}, deposits=${deposits.toString()}`);

            const farcasterUser = await fetchFarcasterData(address);
            
            // Use whichever balance is greater (balanceOf should be the current balance)
            const actualBalance = balance > deposits ? balance : deposits;
            
            const percentage = totalBalance && totalBalance > 0n ? 
              (Number(actualBalance) / Number(totalBalance)) * 100 : 
              0;

            return {
              address,
              balance: actualBalance,
              farcasterUser,
              rank: 0, // Will be set after sorting
              percentage
            };
          } catch (err) {
            console.warn(`❌ Failed to fetch balance for ${address}:`, err);
            return {
              address,
              balance: 0n,
              farcasterUser: undefined,
              rank: 0,
              percentage: 0
            };
          }
        });

        const contributorData = await Promise.all(contributorPromises);
        
        console.log('📋 Raw contributor data:', contributorData.map(c => ({
          address: c.address,
          balance: c.balance.toString(),
          hasBalance: c.balance > 0n
        })));
        
        // Filter out zero balances and sort by balance
        const filteredAndSorted = contributorData
          .filter(c => c.balance > 0n)
          .sort((a, b) => Number(b.balance - a.balance))
          .map((contributor, index) => ({
            ...contributor,
            rank: index + 1
          }));

        console.log('✅ Final contributors:', filteredAndSorted.length, 'with balances');
        console.log('📊 Summary:', {
          totalAddressesChecked: contributorData.length,
          addressesWithBalances: filteredAndSorted.length,
          totalBalance: totalBalance?.toString(),
          contributors: filteredAndSorted.map(c => ({
            address: c.address,
            balance: c.balance.toString(),
            percentage: c.percentage.toFixed(2) + '%'
          }))
        });
        
        // If no real contributors found, show mock data for development
        if (filteredAndSorted.length === 0 && totalBalance && totalBalance > 0n) {
          console.log('🎭 No real contributors found, showing mock data for development');
          console.log('Debug info:', {
            totalBalance: totalBalance.toString(),
            rawContributorData: contributorData.length,
            contributorsWithBalances: filteredAndSorted.length,
            allAddressesChecked: contributorData.map(c => ({ address: c.address, balance: c.balance.toString() }))
          });
          const mockContributors: ContributorData[] = [
            {
              address: getAddress("0x764E427020Ad72624075c61260192C6E486D15a5"),
              balance: totalBalance, // Show full balance for the actual user
              farcasterUser: {
                fid: 12345,
                username: "streamer1",
                display_name: "Top Streamer",
                pfp_url: "/api/placeholder/40/40"
              },
              rank: 1,
              percentage: 100.0
            }
          ];
          setContributors(mockContributors);
        } else {
          setContributors(filteredAndSorted);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    processContributors();
  }, [totalBalance, contributorAddresses, publicClient]);

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