"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { 
  STREME_STAKING_REWARDS_FUNDER_ADDRESS, 
  STREME_STAKING_REWARDS_FUNDER_ABI,
  ERC20_ABI 
} from "@/src/lib/contracts/StremeStakingRewardsFunder";

export const useStremeStakingContract = (overrideAddress?: string, contractAddress?: string) => {
  const { address: wagmiAddress } = useAccount();
  const address = overrideAddress || wagmiAddress;
  const contractAddr = contractAddress || STREME_STAKING_REWARDS_FUNDER_ADDRESS;
  const stakingContract = contractAddr as `0x${string}`;
  const [stakedStremeCoinAddress, setStakedStremeCoinAddress] = useState<string>("");
  const [stremeCoinAddress, setStremeCoinAddress] = useState<string>("");

  // Get contract addresses
  const { data: stakedStremeAddress } = useReadContract({
    address: stakingContract,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "stakedStremeCoin",
  });

  const { data: stremeAddress } = useReadContract({
    address: stakingContract,
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
    address: stakingContract,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    },
  });


  // Read total balance in contract
  const { data: totalBalance, refetch: refetchTotalBalance } = useReadContract({
    address: stakingContract,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "totalBalance",
  });

  // Read accumulated rewards
  const { data: rewardsBalance } = useReadContract({
    address: stakingContract,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "stremeCoinBalance",
  });

  // Read user's staked STREME token balance
  const { data: userStakedTokenBalance, refetch: refetchUserStakedTokenBalance } = useReadContract({
    address: stakedStremeCoinAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!stakedStremeCoinAddress && !!address,
    },
  });

  // Read user's allowance for the contract
  const { data: userAllowance, refetch: refetchAllowance } = useReadContract({
    address: stakedStremeCoinAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address as `0x${string}`, stakingContract] : undefined,
    query: {
      enabled: !!stakedStremeCoinAddress && !!address,
    },
  });

  // Check if contract is paused
  const { data: isPaused } = useReadContract({
    address: stakingContract,
    abi: STREME_STAKING_REWARDS_FUNDER_ABI,
    functionName: "paused",
  });

  return {
    // Contract addresses
    contractAddress: stakingContract,
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
    refetchTotalBalance,
    refetchAllowance,
    refetchUserStakedTokenBalance,
  };
};

export const useStakingContractActions = (overrideAddress?: string, contractAddress?: string) => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [customHash, setCustomHash] = useState<`0x${string}` | undefined>();
  const [customError, setCustomError] = useState<Error | null>(null);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: hash || customHash,
  });

  const { 
    stakedStremeCoinAddress, 
    userStakedTokenBalance, 
    userDepositBalance, 
    refetchUserBalance, 
    refetchTotalBalance, 
    refetchAllowance,
    refetchUserStakedTokenBalance
  } = useStremeStakingContract(overrideAddress, contractAddress);

  // Combined error from wagmi or custom transactions
  const effectiveError = error || customError;
  const effectiveHash = hash || customHash;

  // Helper to convert address to hex
  const toHex = (address: string) => address as `0x${string}`;

  // Approve tokens for the contract
  const approveTokens = async (amount: string, isMiniApp?: boolean, address?: string) => {
    const currentContract = (contractAddress || STREME_STAKING_REWARDS_FUNDER_ADDRESS) as `0x${string}`;
    if (!stakedStremeCoinAddress) {
      throw new Error("Staked token address not loaded");
    }

    setIsApproving(true);
    setCustomError(null);
    
    try {
      let amountBigInt = parseUnits(amount, 18);
      
      // For approval, add a small buffer to prevent rounding errors
      // This ensures approval is always >= the actual amount to be spent
      const buffer = amountBigInt / 10000n; // 0.01% buffer
      amountBigInt = amountBigInt + buffer;

      if (isMiniApp && address) {
        // Handle mini-app transaction
        const sdk = await import("@farcaster/miniapp-sdk");
        const ethProvider = await sdk.default.wallet.getEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available");
        }

        const { Interface } = await import("@ethersproject/abi");
        const iface = new Interface(ERC20_ABI);
        const data = iface.encodeFunctionData("approve", [
          currentContract,
          amountBigInt,
        ]);

        const txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(stakedStremeCoinAddress),
              from: toHex(address),
              data: toHex(data),
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });

        if (!txHash) {
          throw new Error("Transaction hash not received. User might have cancelled.");
        }

        setCustomHash(txHash);
      } else {
        // Handle wagmi transaction
        writeContract({
          address: stakedStremeCoinAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [currentContract, amountBigInt],
        });
      }
    } catch (err) {
      setIsApproving(false);
      if (err instanceof Error) {
        setCustomError(err);
      }
      throw err;
    }
  };

  // Deposit staked tokens
  const depositTokens = async (amount: string, isMiniApp?: boolean, address?: string) => {
    const currentContract = (contractAddress || STREME_STAKING_REWARDS_FUNDER_ADDRESS) as `0x${string}`;
    setIsDepositing(true);
    setCustomError(null);
    
    try {
      let amountBigInt = parseUnits(amount, 18);
      
      // For deposit, ensure we don't exceed the user's actual balance
      // This prevents rounding errors when staking max amount
      if (userStakedTokenBalance && amountBigInt > userStakedTokenBalance) {
        amountBigInt = userStakedTokenBalance;
      }

      if (isMiniApp && address) {
        // Handle mini-app transaction
        const sdk = await import("@farcaster/miniapp-sdk");
        const ethProvider = await sdk.default.wallet.getEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available");
        }

        const { Interface } = await import("@ethersproject/abi");
        const iface = new Interface(STREME_STAKING_REWARDS_FUNDER_ABI);
        const data = iface.encodeFunctionData("deposit", [amountBigInt]);

        const txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(currentContract),
              from: toHex(address),
              data: toHex(data),
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });

        if (!txHash) {
          throw new Error("Transaction hash not received. User might have cancelled.");
        }

        setCustomHash(txHash);
      } else {
        // Handle wagmi transaction
        writeContract({
          address: currentContract,
          abi: STREME_STAKING_REWARDS_FUNDER_ABI,
          functionName: "deposit",
          args: [amountBigInt],
        });
      }
    } catch (err) {
      setIsDepositing(false);
      if (err instanceof Error) {
        setCustomError(err);
      }
      throw err;
    }
  };

  // Withdraw specific amount
  const withdrawTokens = async (amount: string, isMiniApp?: boolean, address?: string) => {
    const currentContract = (contractAddress || STREME_STAKING_REWARDS_FUNDER_ADDRESS) as `0x${string}`;
    setIsWithdrawing(true);
    setCustomError(null);
    
    try {
      let amountBigInt = parseUnits(amount, 18);
      
      // For withdraw, ensure we don't exceed the user's deposit balance
      // This prevents rounding errors when withdrawing max amount
      if (userDepositBalance && amountBigInt > userDepositBalance) {
        amountBigInt = userDepositBalance;
      }

      if (isMiniApp && address) {
        // Handle mini-app transaction
        const sdk = await import("@farcaster/miniapp-sdk");
        const ethProvider = await sdk.default.wallet.getEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available");
        }

        const { Interface } = await import("@ethersproject/abi");
        const iface = new Interface(STREME_STAKING_REWARDS_FUNDER_ABI);
        const data = iface.encodeFunctionData("withdraw", [amountBigInt]);

        const txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(currentContract),
              from: toHex(address),
              data: toHex(data),
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });

        if (!txHash) {
          throw new Error("Transaction hash not received. User might have cancelled.");
        }

        setCustomHash(txHash);
      } else {
        // Handle wagmi transaction
        writeContract({
          address: currentContract,
          abi: STREME_STAKING_REWARDS_FUNDER_ABI,
          functionName: "withdraw",
          args: [amountBigInt],
        });
      }
    } catch (err) {
      setIsWithdrawing(false);
      if (err instanceof Error) {
        setCustomError(err);
      }
      throw err;
    }
  };

  // Withdraw all tokens
  const withdrawAllTokens = async (isMiniApp?: boolean, address?: string) => {
    const currentContract = (contractAddress || STREME_STAKING_REWARDS_FUNDER_ADDRESS) as `0x${string}`;
    setIsWithdrawing(true);
    setCustomError(null);
    
    try {
      if (isMiniApp && address) {
        // Handle mini-app transaction
        const sdk = await import("@farcaster/miniapp-sdk");
        const ethProvider = await sdk.default.wallet.getEthereumProvider();
        if (!ethProvider) {
          throw new Error("Farcaster Ethereum provider not available");
        }

        const { Interface } = await import("@ethersproject/abi");
        const iface = new Interface(STREME_STAKING_REWARDS_FUNDER_ABI);
        const data = iface.encodeFunctionData("withdrawAll", []);

        const txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(currentContract),
              from: toHex(address),
              data: toHex(data),
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });

        if (!txHash) {
          throw new Error("Transaction hash not received. User might have cancelled.");
        }

        setCustomHash(txHash);
      } else {
        // Handle wagmi transaction
        writeContract({
          address: currentContract,
          abi: STREME_STAKING_REWARDS_FUNDER_ABI,
          functionName: "withdrawAll",
        });
      }
    } catch (err) {
      setIsWithdrawing(false);
      if (err instanceof Error) {
        setCustomError(err);
      }
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
      refetchTotalBalance();
      refetchAllowance();
      refetchUserStakedTokenBalance();
    }
  }, [isConfirmed, refetchUserBalance, refetchTotalBalance, refetchAllowance, refetchUserStakedTokenBalance]);

  // Reset loading states when there's an error (transaction failed or cancelled)
  useEffect(() => {
    if (effectiveError) {
      console.log("Transaction error detected, resetting loading states:", effectiveError);
      setIsApproving(false);
      setIsDepositing(false);
      setIsWithdrawing(false);
    }
  }, [effectiveError]);

  return {
    // Actions
    approveTokens,
    depositTokens,
    withdrawTokens,
    withdrawAllTokens,
    
    // Transaction status
    hash: effectiveHash,
    error: effectiveError,
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