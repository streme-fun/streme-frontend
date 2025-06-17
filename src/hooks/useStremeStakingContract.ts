"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { 
  STREME_STAKING_REWARDS_FUNDER_ADDRESS, 
  STREME_STAKING_REWARDS_FUNDER_ABI,
  ERC20_ABI 
} from "@/src/lib/contracts/StremeStakingRewardsFunder";

export const useStremeStakingContract = () => {
  const { address } = useAccount();
  const [stakedStremeCoinAddress, setStakedStremeCoinAddress] = useState<string>("");
  const [stremeCoinAddress, setStremeCoinAddress] = useState<string>("");

  // Get contract addresses
  const { data: stakedStremeAddress } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "stakedStremeCoin",
  });

  const { data: stremeAddress } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "stremeCoin",
  });

  useEffect(() => {
    if (stakedStremeAddress) {
      setStakedStremeCoinAddress(stakedStremeAddress as string);
    }
    if (stremeAddress) {
      setStremeCoinAddress(stremeAddress as string);
    }
  }, [stakedStremeAddress, stremeAddress]);

  // Read user's deposit balance
  const { data: userDepositBalance, refetch: refetchUserBalance } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read total balance in contract
  const { data: totalBalance } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "totalBalance",
  });

  // Read accumulated rewards
  const { data: rewardsBalance } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "stremeCoinBalance",
  });

  // Read user's staked STREME token balance
  const { data: userStakedTokenBalance } = useReadContract({
    address: stakedStremeCoinAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!stakedStremeCoinAddress && !!address,
    },
  });

  // Read user's allowance for the contract
  const { data: userAllowance, refetch: refetchAllowance } = useReadContract({
    address: stakedStremeCoinAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, STREME_STAKING_REWARDS_FUNDER_ADDRESS] : undefined,
    query: {
      enabled: !!stakedStremeCoinAddress && !!address,
    },
  });

  // Check if contract is paused
  const { data: isPaused } = useReadContract({
    address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "paused",
  });

  return {
    // Contract addresses
    contractAddress: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
    stakedStremeCoinAddress,
    stremeCoinAddress,
    
    // Balances (as bigint)
    userDepositBalance: userDepositBalance as bigint | undefined,
    totalBalance: totalBalance as bigint | undefined,
    rewardsBalance: rewardsBalance as bigint | undefined,
    userStakedTokenBalance: userStakedTokenBalance as bigint | undefined,
    userAllowance: userAllowance as bigint | undefined,
    
    // Status
    isPaused: isPaused as boolean | undefined,
    
    // Refetch functions
    refetchUserBalance,
    refetchAllowance,
  };
};

export const useStakingContractActions = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const { stakedStremeCoinAddress, refetchUserBalance, refetchAllowance } = useStremeStakingContract();

  // Approve tokens for the contract
  const approveTokens = async (amount: string) => {
    if (!stakedStremeCoinAddress) {
      throw new Error("Staked STREME token address not loaded");
    }

    setIsApproving(true);
    try {
      const amountBigInt = parseUnits(amount, 18);
      writeContract({
        address: stakedStremeCoinAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [STREME_STAKING_REWARDS_FUNDER_ADDRESS, amountBigInt],
      });
    } catch (err) {
      setIsApproving(false);
      throw err;
    }
  };

  // Deposit staked STREME tokens
  const depositTokens = async (amount: string) => {
    setIsDepositing(true);
    try {
      const amountBigInt = parseUnits(amount, 18);
      writeContract({
        address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
        abi: STREME_STAKING_REWARDS_FUNDER_ABI,
        functionName: "deposit",
        args: [amountBigInt],
      });
    } catch (err) {
      setIsDepositing(false);
      throw err;
    }
  };

  // Withdraw specific amount
  const withdrawTokens = async (amount: string) => {
    setIsWithdrawing(true);
    try {
      const amountBigInt = parseUnits(amount, 18);
      writeContract({
        address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
        abi: STREME_STAKING_REWARDS_FUNDER_ABI,
        functionName: "withdraw",
        args: [amountBigInt],
      });
    } catch (err) {
      setIsWithdrawing(false);
      throw err;
    }
  };

  // Withdraw all tokens
  const withdrawAllTokens = async () => {
    setIsWithdrawing(true);
    try {
      writeContract({
        address: STREME_STAKING_REWARDS_FUNDER_ADDRESS,
        abi: STREME_STAKING_REWARDS_FUNDER_ABI,
        functionName: "withdrawAll",
      });
    } catch (err) {
      setIsWithdrawing(false);
      throw err;
    }
  };

  // Reset loading states when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      setIsApproving(false);
      setIsDepositing(false);
      setIsWithdrawing(false);
      
      // Refetch balances after successful transaction
      refetchUserBalance();
      refetchAllowance();
    }
  }, [isConfirmed, refetchUserBalance, refetchAllowance]);

  return {
    // Actions
    approveTokens,
    depositTokens,
    withdrawTokens,
    withdrawAllTokens,
    
    // Transaction status
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
    
    // Action-specific loading states
    isApproving,
    isDepositing,
    isWithdrawing,
  };
};

// Helper functions for formatting
export const formatStakeAmount = (amount: bigint | undefined, decimals = 18): string => {
  if (!amount) return "0";
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  return num.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

export const parseStakeAmount = (amount: string, decimals = 18): bigint => {
  return parseUnits(amount, decimals);
};