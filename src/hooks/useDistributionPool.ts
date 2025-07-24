"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address, decodeEventLog } from "viem";
import { BestFriend } from "@/src/lib/neynar";
import { 
  PoolInfo,
  DistributionRecord,
  getBestFriendAddress,
  prepareCreatePool,
  prepareUpdateMember,
  prepareStreamToPool,
  getFlowRateToPool,
  dailyAmountToFlowRate,
  UNITS_PER_FRIEND,
  STREME_SUPER_TOKEN,
  GDA_V1_FORWARDER_ABI
} from "@/src/lib/superfluid-pools";
import { GDA_V1_FORWARDER } from "@/src/lib/superfluid-contracts";
import { useStremeFlowRate } from "./useStremeFlowRate";
import { useAppFrameLogic } from "./useAppFrameLogic";

// Pool states
export type PoolState = 
  | "none"          // No pool created
  | "creating"      // Creating pool
  | "adding_members"// Adding friends as members
  | "ready"         // Ready for distributions
  | "streaming"     // Currently setting up stream
  | "active"        // Actively streaming to pool
  | "error";        // Error state

export interface PoolManagementState {
  state: PoolState;
  pool: PoolInfo | null;
  poolAddress: Address | null;
  selectedFriends: BestFriend[];
  dailyAmount: bigint;
  currentFlowRate: bigint;
  distributions: DistributionRecord[];
  error: string | null;
  txHash: string | null;
  // Member addition tracking
  pendingMembers: BestFriend[];
  currentMemberIndex: number;
}

export function useDistributionPool() {
  const { address: wagmiAddress } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();
  const { flowRate, isLoading: flowRateLoading } = useStremeFlowRate();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get effective address based on context (mini-app vs wallet)
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  const [state, setState] = useState<PoolManagementState>({
    state: "none",
    pool: null,
    poolAddress: null,
    selectedFriends: [],
    dailyAmount: BigInt(0),
    currentFlowRate: BigInt(0),
    distributions: [],
    error: null,
    txHash: null,
    pendingMembers: [],
    currentMemberIndex: 0,
  });

  // Calculate daily distribution amount (80% of staking rewards)
  const dailyAmount = useMemo(() => {
    console.log("[useDistributionPool] Flow rate:", flowRate);
    if (!flowRate || flowRate === "0") {
      console.log("[useDistributionPool] No flow rate available");
      return BigInt(0);
    }
    
    const dailyAmount = parseFloat(flowRate);
    // Use 80% of daily rewards for distributions
    const distributionAmount = dailyAmount * 0.8;
    
    console.log("[useDistributionPool] Calculated daily amount:", distributionAmount);
    return BigInt(Math.floor(distributionAmount * 1e18));
  }, [flowRate]);

  // Update daily amount when it changes
  useEffect(() => {
    setState(prev => {
      // Clear error if we now have a daily amount and the error was about no rewards
      const shouldClearError = dailyAmount > 0 && 
        prev.error === "No STREME rewards available. You need active staking rewards to create a distribution pool.";
      
      return { 
        ...prev, 
        dailyAmount,
        error: shouldClearError ? null : prev.error
      };
    });
  }, [dailyAmount]);

  // Check current flow rate to pool and update state accordingly
  useEffect(() => {
    const checkCurrentFlowRate = async () => {
      if (!effectiveAddress || !state.poolAddress || state.state === "none") {
        return;
      }

      try {
        const currentFlowRate = await getFlowRateToPool(effectiveAddress, state.poolAddress);
        
        setState(prev => {
          const newState = { ...prev, currentFlowRate };
          
          // Update pool state based on flow rate
          if (currentFlowRate > 0 && prev.state === "ready") {
            newState.state = "active";
          } else if (currentFlowRate === BigInt(0) && prev.state === "active") {
            newState.state = "ready";
          }
          
          return newState;
        });
      } catch (error) {
        console.error("[useDistributionPool] Error checking flow rate:", error);
      }
    };

    // Check flow rate when pool address changes or becomes available
    if (state.poolAddress && effectiveAddress) {
      checkCurrentFlowRate();
    }
  }, [effectiveAddress, state.poolAddress, state.state]);

  // Auto-add members when pool creation is successful
  useEffect(() => {
    if (state.state === "adding_members" && state.poolAddress && state.selectedFriends.length > 0 && state.pendingMembers.length === 0) {
      console.log("[useDistributionPool] Pool created, setting up member addition queue...");
      console.log("[useDistributionPool] Pool address:", state.poolAddress);
      console.log("[useDistributionPool] Selected friends:", state.selectedFriends.length);
      
      if (!state.poolAddress) {
        setState(prev => ({
          ...prev,
          state: "error",
          error: "Failed to extract pool address from transaction. Pool creation may have failed.",
        }));
        return;
      }
      
      // Filter friends with valid addresses and set up the pending members queue
      const validFriends = state.selectedFriends.filter(friend => {
        const address = getBestFriendAddress(friend);
        if (!address) {
          console.warn(`[useDistributionPool] Skipping friend ${friend.username} - no valid address`);
          return false;
        }
        return true;
      });

      if (validFriends.length === 0) {
        setState(prev => ({
          ...prev,
          state: "error",
          error: "None of the selected friends have valid Ethereum addresses",
        }));
        return;
      }

      console.log(`[useDistributionPool] Setting up queue for ${validFriends.length} valid friends`);
      
      // Initialize the member addition queue
      setState(prev => ({
        ...prev,
        pendingMembers: validFriends,
        currentMemberIndex: 0,
        error: null,
      }));
    }
  }, [state.state, state.poolAddress, state.selectedFriends.length, state.selectedFriends, state.pendingMembers.length]);

  // Process pending member additions
  useEffect(() => {
    if (state.state === "adding_members" && 
        state.poolAddress && 
        state.pendingMembers.length > 0 && 
        state.currentMemberIndex < state.pendingMembers.length &&
        !isPending && !isConfirming) {
      
      const currentFriend = state.pendingMembers[state.currentMemberIndex];
      const memberAddress = getBestFriendAddress(currentFriend);
      
      if (!memberAddress) {
        console.error(`[useDistributionPool] No valid address for friend ${currentFriend.username}`);
        // Skip this friend and move to the next one
        setState(prev => ({
          ...prev,
          currentMemberIndex: prev.currentMemberIndex + 1,
        }));
        return;
      }

      console.log(`[useDistributionPool] Adding member ${state.currentMemberIndex + 1}/${state.pendingMembers.length}:`, {
        username: currentFriend.username,
        address: memberAddress,
        units: UNITS_PER_FRIEND.toString()
      });

      try {
        const memberTx = prepareUpdateMember(state.poolAddress, memberAddress, UNITS_PER_FRIEND);
        writeContract(memberTx);
      } catch (error) {
        console.error("[useDistributionPool] Failed to prepare member transaction:", error);
        setState(prev => ({
          ...prev,
          state: "error",
          error: error instanceof Error ? error.message : "Failed to add member to pool",
        }));
      }
    }
  }, [state.state, state.poolAddress, state.pendingMembers, state.currentMemberIndex, isPending, isConfirming, writeContract]);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && txHash) {
      setState(prev => {
        // Handle different transaction types based on current state
        if (prev.state === "creating") {
          // Extract pool address from transaction receipt
          let poolAddress: Address | null = null;
          
          if (receipt && receipt.logs && receipt.logs.length > 0) {
            console.log("[useDistributionPool] Transaction receipt logs:", receipt.logs);
            
            try {
              // Debug: log all topics to see what events are being emitted
              console.log("[useDistributionPool] Analyzing", receipt.logs.length, "transaction logs");
              
              for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                console.log(`[useDistributionPool] Log ${i}:`, {
                  address: log.address,
                  topics: log.topics,
                  data: log.data
                });
                
                try {
                  const decodedLog = decodeEventLog({
                    abi: GDA_V1_FORWARDER_ABI,
                    data: log.data,
                    topics: log.topics,
                  });
                  
                  console.log(`[useDistributionPool] Successfully decoded log ${i}:`, decodedLog);
                  
                  // Check for various pool-related events
                  if (decodedLog.eventName === "PoolCreated") {
                    console.log("[useDistributionPool] Found PoolCreated event:", decodedLog);
                    poolAddress = decodedLog.args.pool as Address;
                    console.log("[useDistributionPool] Extracted pool address:", poolAddress);
                    break;
                  } else if (decodedLog.eventName === "PoolConnectionUpdated") {
                    console.log("[useDistributionPool] Found PoolConnectionUpdated event:", decodedLog);
                    poolAddress = decodedLog.args.pool as Address;
                    console.log("[useDistributionPool] Extracted pool address:", poolAddress);
                    break;
                  }
                } catch (logError) {
                  // Skip logs that don't match our ABI - this is expected for other contracts' events
                  console.log(`[useDistributionPool] Could not decode log ${i} (likely from different contract):`, logError);
                  continue;
                }
              }
            } catch (error) {
              console.error("[useDistributionPool] Failed to process logs:", error);
            }
          }
          
          // Fallback: If we couldn't get the pool address from events, try other approaches
          if (!poolAddress) {
            console.warn("[useDistributionPool] Could not extract pool address from receipt");
            
            // Alternative approach: The pool address might be in the logs as a topic or data
            // Let's try to find any address that looks like a pool address
            if (receipt.logs.length > 0) {
              console.log("[useDistributionPool] Attempting fallback pool address extraction...");
              
              // Look for the GDA_V1_FORWARDER address in logs to identify relevant events
              const gdaLogs = receipt.logs.filter(log => 
                log.address.toLowerCase() === GDA_V1_FORWARDER.toLowerCase()
              );
              
              console.log("[useDistributionPool] Found", gdaLogs.length, "logs from GDA Forwarder");
              
              if (gdaLogs.length > 0) {
                // The pool address might be in the first topic after the event signature
                // or in the data field. For now, let's log what we find.
                gdaLogs.forEach((log, idx) => {
                  console.log(`[useDistributionPool] GDA Log ${idx}:`, log);
                });
              }
            }
          }
          
          return {
            ...prev,
            state: "adding_members",
            poolAddress: poolAddress,
            txHash: txHash,
            error: null,
          };
        } else if (prev.state === "adding_members") {
          // Check if we have more members to add
          const nextMemberIndex = prev.currentMemberIndex + 1;
          const hasMoreMembers = nextMemberIndex < prev.pendingMembers.length;
          
          console.log(`[useDistributionPool] Member ${prev.currentMemberIndex + 1}/${prev.pendingMembers.length} added successfully`);
          
          if (hasMoreMembers) {
            console.log(`[useDistributionPool] Moving to next member (${nextMemberIndex + 1}/${prev.pendingMembers.length})`);
            // More members to add, increment the index and continue
            return {
              ...prev,
              currentMemberIndex: nextMemberIndex,
              txHash: txHash,
              error: null,
            };
          } else {
            console.log("[useDistributionPool] All members added successfully, transitioning to ready");
            // All members added, transition to ready
            return {
              ...prev,
              state: "ready",
              txHash: txHash,
              error: null,
            };
          }
        } else if (prev.state === "streaming") {
          // Stream started or stopped - check the flow rate to determine final state
          // We'll let the flow rate effect handle the state transition
          return {
            ...prev,
            txHash: txHash,
            error: null,
          };
        }
        
        return {
          ...prev,
          txHash: txHash,
          error: null,
        };
      });
    }
  }, [isSuccess, txHash]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      console.error("[useDistributionPool] Write error:", writeError);
      setState(prev => ({
        ...prev,
        state: "error",
        error: writeError.message || "Transaction failed",
      }));
    }
  }, [writeError]);

  // Debug: Track error state changes
  useEffect(() => {
    console.log("[useDistributionPool] Error state changed:", {
      error: state.error,
      poolState: state.state,
      currentFlowRate: flowRate,
      currentDailyAmount: dailyAmount.toString()
    });
  }, [state.error, state.state, flowRate, dailyAmount]);

  // Debug transaction states
  useEffect(() => {
    console.log("[useDistributionPool] Transaction states:", {
      txHash,
      isPending,
      isConfirming,
      isSuccess,
      writeError: writeError?.message,
      poolState: state.state
    });
  }, [txHash, isPending, isConfirming, isSuccess, writeError, state.state]);

  // Safety mechanism: reset state if stuck in creating for too long without transaction
  useEffect(() => {
    if (state.state === "creating" && !isPending && !txHash && !writeError) {
      const timer = setTimeout(() => {
        console.warn("[useDistributionPool] Resetting stuck 'creating' state");
        setState(prev => ({
          ...prev,
          state: "none",
          error: "Pool creation timed out. Please try again."
        }));
      }, 10000); // 10 seconds timeout

      return () => clearTimeout(timer);
    }
  }, [state.state, isPending, txHash, writeError]);

  // Create a new distribution pool
  const createPool = useCallback(async (friends: BestFriend[]): Promise<boolean> => {
    console.log("[useDistributionPool] === CREATE POOL CALLED ===");
    console.log("[useDistributionPool] Callback captured values:", {
      flowRate,
      dailyAmount: dailyAmount.toString(),
      flowRateLoading,
      effectiveAddress,
      isMiniAppView,
      wagmiAddress,
      fcAddress,
      friendsCount: friends.length
    });
    if (!effectiveAddress || friends.length === 0) {
      setState(prev => ({ ...prev, error: "Invalid pool configuration" }));
      return false;
    }

    // Simple, direct validation - bypass complex state logic
    console.log("[useDistributionPool] === VALIDATION START ===");
    console.log("[useDistributionPool] Direct validation values:", {
      flowRateLoading,
      flowRateValue: flowRate,
      flowRateType: typeof flowRate,
      dailyAmountValue: dailyAmount.toString(),
      dailyAmountCheck: dailyAmount > BigInt(0)
    });
    
    if (flowRateLoading) {
      console.log("[useDistributionPool] BLOCKED: Still loading flow rate");
      setState(prev => ({ ...prev, error: "Still loading flow rate data. Please wait..." }));
      return false;
    }

    // Direct check: if flowRate exists and > 0, we should be good
    if (!flowRate || flowRate === "0" || parseFloat(flowRate) <= 0) {
      console.log("[useDistributionPool] BLOCKED: No valid flow rate");
      console.log("[useDistributionPool] FlowRate analysis:", {
        exists: !!flowRate,
        value: flowRate,
        parsed: parseFloat(flowRate || "0"),
        isPositive: parseFloat(flowRate || "0") > 0
      });
      setState(prev => ({ ...prev, error: "No STREME rewards available. You need active staking rewards to create a distribution pool." }));
      return false;
    }
    
    console.log("[useDistributionPool] VALIDATION PASSED - proceeding with pool creation");
    // Clear any existing error since validation passed
    setState(prev => ({ ...prev, error: null }));

    console.log("[useDistributionPool] Creating pool for", friends.length, "friends");
    console.log("[useDistributionPool] User address:", effectiveAddress);
    console.log("[useDistributionPool] Context:", { isMiniAppView, wagmiAddress, fcAddress });
    console.log("[useDistributionPool] Daily amount available:", dailyAmount.toString());
    
    setState(prev => ({
      ...prev,
      state: "creating",
      selectedFriends: friends,
      error: null,
      txHash: null,
    }));

    try {
      // Validate that all friends have valid addresses
      const validFriends = friends.filter(friend => getBestFriendAddress(friend));
      if (validFriends.length !== friends.length) {
        throw new Error("Some friends don't have valid Ethereum addresses");
      }

      // Check user's STREME Super Token balance before creating pool
      try {
        const { publicClient } = await import("@/src/lib/viemClient");
        const balance = await publicClient.readContract({
          address: STREME_SUPER_TOKEN,
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
          args: [effectiveAddress as `0x${string}`],
        });
        
        const balanceBigInt = balance as bigint;
        console.log("[useDistributionPool] User STREME balance:", balanceBigInt.toString(), "wei");
        console.log("[useDistributionPool] User STREME balance:", Number(balanceBigInt) / 1e18, "tokens");
        
        if (balanceBigInt === 0n) {
          throw new Error("You need some STREME tokens in your wallet to create a distribution pool. Please get some STREME first.");
        }
      } catch (balanceError) {
        console.error("[useDistributionPool] Balance check failed:", balanceError);
        // Don't block pool creation for balance check failures - just warn
        console.warn("[useDistributionPool] Proceeding without balance check");
      }

      // Create the pool
      const poolTx = prepareCreatePool(effectiveAddress);
      console.log("[useDistributionPool] Pool transaction config:", poolTx);
      console.log("[useDistributionPool] Transaction args breakdown:", {
        token: poolTx.args[0],
        admin: poolTx.args[1], 
        config: poolTx.args[2]
      });
      console.log("[useDistributionPool] About to call writeContract");
      
      writeContract(poolTx);
      console.log("[useDistributionPool] writeContract called");
      
      return true;
    } catch (error) {
      console.error("Pool creation failed:", error);
      setState(prev => ({
        ...prev,
        state: "error",
        error: error instanceof Error ? error.message : "Pool creation failed",
      }));
      return false;
    }
  }, [effectiveAddress, writeContract, flowRate, dailyAmount, flowRateLoading, state.state]);

  // Add members to an existing pool (called after pool creation)
  const addMembersToPool = useCallback(async (poolAddress: Address): Promise<boolean> => {
    if (!effectiveAddress || !poolAddress || state.selectedFriends.length === 0) {
      setState(prev => ({ ...prev, error: "Invalid member configuration" }));
      return false;
    }

    console.log("[useDistributionPool] Adding", state.selectedFriends.length, "members to pool:", poolAddress);
    
    // Don't change state here since we're already in "adding_members" state
    // Just update the error field
    setState(prev => ({
      ...prev,
      error: null,
    }));

    try {
      // Add all friends to the pool sequentially
      for (let i = 0; i < state.selectedFriends.length; i++) {
        const friend = state.selectedFriends[i];
        const memberAddress = getBestFriendAddress(friend);
        
        if (!memberAddress) {
          console.warn(`[useDistributionPool] Skipping friend ${friend.username} - no valid address`);
          continue;
        }

        console.log(`[useDistributionPool] Adding member ${i + 1}/${state.selectedFriends.length}:`, {
          username: friend.username,
          address: memberAddress,
          units: UNITS_PER_FRIEND.toString()
        });

        const memberTx = prepareUpdateMember(poolAddress, memberAddress, UNITS_PER_FRIEND);
        
        // For the first member, call writeContract immediately
        // For subsequent members, we'll need to wait for the previous transaction to complete
        if (i === 0) {
          writeContract(memberTx);
          // The transaction success will be handled by the existing useEffect
          return true;
        }
        
        // TODO: For multiple members, we need to queue the transactions
        // For now, we'll just add the first member to test the flow
        console.log(`[useDistributionPool] Queuing additional member ${friend.username} for future implementation`);
      }
      
      return true;
    } catch (error) {
      console.error("Adding members failed:", error);
      setState(prev => ({
        ...prev,
        state: "error",
        error: error instanceof Error ? error.message : "Failed to add members",
      }));
      return false;
    }
  }, [effectiveAddress, state.selectedFriends, writeContract]);

  // Start streaming to pool members (replaces one-time distribution)
  const startStreaming = useCallback(async (poolAddress: Address): Promise<boolean> => {
    if (!effectiveAddress || !poolAddress || dailyAmount === BigInt(0)) {
      setState(prev => ({ ...prev, error: "Invalid streaming configuration" }));
      return false;
    }

    // Convert daily amount to flow rate (tokens per second)
    const flowRate = dailyAmountToFlowRate(dailyAmount);
    console.log("[useDistributionPool] Starting stream with daily amount:", dailyAmount.toString());
    console.log("[useDistributionPool] Flow rate (tokens/second):", flowRate.toString());
    
    setState(prev => ({
      ...prev,
      state: "streaming",
      error: null,
    }));

    try {
      // Check balance before streaming - need buffer for Superfluid
      try {
        const { publicClient } = await import("@/src/lib/viemClient");
        const balance = await publicClient.readContract({
          address: STREME_SUPER_TOKEN,
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
          args: [effectiveAddress as `0x${string}`],
        });
        
        const balanceBigInt = balance as bigint;
        // For streaming, need at least 4 hours of buffer (conservative estimate)
        const requiredBuffer = flowRate * BigInt(4 * 3600); // 4 hours worth
        if (balanceBigInt < requiredBuffer) {
          throw new Error(`Insufficient balance for streaming. You need at least ${Number(requiredBuffer) / 1e18} STREME for the buffer`);
        }
      } catch (balanceError) {
        console.error("[useDistributionPool] Balance check failed:", balanceError);
        // Don't block streaming for balance check failures - let the transaction fail with proper error
        console.warn("[useDistributionPool] Proceeding without balance check");
      }

      const streamTx = prepareStreamToPool(effectiveAddress, poolAddress, flowRate);
      writeContract(streamTx);
      
      return true;
    } catch (error) {
      console.error("Streaming failed:", error);
      setState(prev => ({
        ...prev,
        state: "error",
        error: error instanceof Error ? error.message : "Streaming failed",
      }));
      return false;
    }
  }, [effectiveAddress, dailyAmount, writeContract]);

  // Stop streaming to pool
  const stopStreaming = useCallback(async (poolAddress: Address): Promise<boolean> => {
    if (!effectiveAddress || !poolAddress) {
      setState(prev => ({ ...prev, error: "Invalid streaming configuration" }));
      return false;
    }

    console.log("[useDistributionPool] Stopping stream to pool");
    
    setState(prev => ({
      ...prev,
      state: "streaming",
      error: null,
    }));

    try {
      // Set flow rate to 0 to stop streaming
      const streamTx = prepareStreamToPool(effectiveAddress, poolAddress, BigInt(0));
      writeContract(streamTx);
      
      return true;
    } catch (error) {
      console.error("Stop streaming failed:", error);
      setState(prev => ({
        ...prev,
        state: "error",
        error: error instanceof Error ? error.message : "Stop streaming failed",
      }));
      return false;
    }
  }, [effectiveAddress, writeContract]);

  // Update selected friends (before pool creation)
  const updateSelectedFriends = useCallback((friends: BestFriend[]) => {
    setState(prev => ({
      ...prev,
      selectedFriends: friends,
      error: null,
    }));
  }, []);

  // Clear errors
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset pool state
  const resetPool = useCallback(() => {
    setState({
      state: "none",
      pool: null,
      poolAddress: null,
      selectedFriends: [],
      dailyAmount: BigInt(0),
      currentFlowRate: BigInt(0),
      distributions: [],
      error: null,
      txHash: null,
      pendingMembers: [],
      currentMemberIndex: 0,
    });
  }, []);

  // Get current loading state
  const isLoading = isPending || isConfirming || 
    state.state === "creating" || 
    state.state === "adding_members" || 
    state.state === "streaming";

  // Check if ready for operations - use computed dailyAmount for reliability
  const canCreatePool = !isLoading && !flowRateLoading && state.selectedFriends.length > 0 && state.state === "none" && dailyAmount > 0;
  const canStartStream = !isLoading && state.state === "ready" && dailyAmount > 0;
  const canStopStream = !isLoading && state.state === "active";

  return {
    // State
    poolState: state.state,
    pool: state.pool,
    poolAddress: state.poolAddress,
    selectedFriends: state.selectedFriends,
    dailyAmount: dailyAmount, // Use computed value
    currentFlowRate: state.currentFlowRate,
    distributions: state.distributions,
    error: state.error || (writeError?.message),
    txHash: txHash || state.txHash,
    
    // Member addition progress
    pendingMembers: state.pendingMembers,
    currentMemberIndex: state.currentMemberIndex,
    totalMembers: state.pendingMembers.length,
    
    // Loading states
    isLoading,
    flowRateLoading,
    
    // Capabilities
    canCreatePool,
    canStartStream,
    canStopStream,
    
    // Actions
    createPool,
    addMembersToPool,
    startStreaming,
    stopStreaming,
    updateSelectedFriends,
    clearError,
    resetPool,
  };
}