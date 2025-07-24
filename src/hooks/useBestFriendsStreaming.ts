"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BestFriend } from "@/src/lib/neynar";
import { 
  createStreamingSummary, 
  StreamingSummary,
  CFA_V1_FORWARDER_ABI,
  STREME_SUPER_TOKEN,
  getBestFriendAddress,
  getRequiredBuffer
} from "@/src/lib/superfluid-streaming";
import { publicClient } from "@/src/lib/viemClient";
import { CFA_V1_FORWARDER } from "@/src/lib/superfluid-contracts";
import { useStremeFlowRate } from "./useStremeFlowRate";

export interface StreamingState {
  selectedFriends: BestFriend[];
  isStreaming: boolean;
  streamingSummary: StreamingSummary | null;
  error: string | null;
  txHash: string | null;
}

export function useBestFriendsStreaming() {
  const { address } = useAccount();
  const { flowRate, isLoading: flowRateLoading } = useStremeFlowRate();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  
  const [state, setState] = useState<StreamingState>({
    selectedFriends: [],
    isStreaming: false,
    streamingSummary: null,
    error: null,
    txHash: null,
  });

  // Calculate available flow rate in wei per second (use 80% of staking rewards for safety)
  const availableFlowRate = useMemo(() => {
    if (!flowRate || flowRate === "0") return BigInt(0);
    
    // flowRate is in STREME/day as a decimal string (e.g., "1659788.9192")
    // Need to convert to wei per second for Superfluid
    const flowRateFloat = parseFloat(flowRate);
    console.log("[useBestFriendsStreaming] Flow rate from hook:", flowRateFloat, "STREME/day");
    
    // Convert to wei per day first
    const flowRateWeiPerDay = BigInt(Math.floor(flowRateFloat * 1e18));
    console.log("[useBestFriendsStreaming] Wei per day:", flowRateWeiPerDay.toString());
    
    // Convert to wei per second (Superfluid uses per-second rates)
    const flowRateWeiPerSecond = flowRateWeiPerDay / BigInt(86400);
    console.log("[useBestFriendsStreaming] Wei per second:", flowRateWeiPerSecond.toString());
    
    // Apply 50% buffer for safety (more conservative)
    const result = (flowRateWeiPerSecond * BigInt(50)) / BigInt(100);
    console.log("[useBestFriendsStreaming] Final available flow rate:", result.toString(), "wei/sec");
    
    return result;
  }, [flowRate]);

  // Update selected friends and recalculate summary
  const updateSelectedFriends = useCallback(async (friends: BestFriend[]) => {
    setState(prev => ({ ...prev, selectedFriends: friends, error: null }));
    
    if (friends.length === 0) {
      setState(prev => ({ ...prev, streamingSummary: null }));
      return;
    }

    try {
      const summary = await createStreamingSummary(
        availableFlowRate,
        friends,
        address
      );
      setState(prev => ({ ...prev, streamingSummary: summary }));
    } catch (error) {
      console.error("Error creating streaming summary:", error);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to calculate streaming summary",
        streamingSummary: null 
      }));
    }
  }, [availableFlowRate, address]);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && txHash) {
      setState(prev => ({ 
        ...prev, 
        isStreaming: false, 
        txHash: txHash,
        error: null 
      }));
    }
  }, [isSuccess, txHash]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      setState(prev => ({ 
        ...prev, 
        isStreaming: false, 
        error: writeError.message || "Transaction failed"
      }));
    }
  }, [writeError]);

  // Execute the streaming transaction
  const executeStreaming = useCallback(async (): Promise<boolean> => {
    if (!address || !state.streamingSummary || state.selectedFriends.length === 0) {
      setState(prev => ({ ...prev, error: "Invalid streaming configuration" }));
      return false;
    }

    setState(prev => ({ ...prev, isStreaming: true, error: null, txHash: null }));

    try {
      // For now, let's start with the first friend to test the transaction
      // Later we can implement multicall for multiple friends
      const firstFriend = state.selectedFriends[0];
      const recipientAddress = getBestFriendAddress(firstFriend);
      
      if (!recipientAddress) {
        throw new Error("No valid recipient address found");
      }

      const flowRatePerFriend = state.streamingSummary.flowRatePerFriend;
      
      // Convert to int96 format (Superfluid uses signed 96-bit integers)
      // For positive flow rates, we can safely cast BigInt to the signed format
      const flowRateInt96 = flowRatePerFriend;
      
      console.log("Starting stream:", {
        token: STREME_SUPER_TOKEN,
        receiver: recipientAddress,
        flowRate: flowRateInt96.toString(),
        flowRatePerDay: (Number(flowRateInt96) * 86400 / 1e18).toFixed(2) + " STREME/day"
      });

      // Check current balance
      const currentBalance = await publicClient.readContract({
        address: STREME_SUPER_TOKEN,
        abi: [
          {
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function"
          }
        ],
        functionName: "balanceOf",
        args: [address],
      });

      const balance = currentBalance as bigint;
      console.log("Current STREME balance:", balance.toString());

      // Check required buffer
      try {
        const requiredBuffer = await getRequiredBuffer(flowRatePerFriend);
        console.log("Required buffer:", requiredBuffer.toString());
        
        if (balance < requiredBuffer) {
          throw new Error(`Insufficient balance. You need at least ${Number(requiredBuffer) / 1e18} STREME to start this stream.`);
        }
      } catch (bufferError) {
        console.warn("Could not check buffer requirement:", bufferError);
        // Continue anyway - let the transaction fail with the actual error
      }

      // Execute the setFlowrate transaction
      writeContract({
        address: CFA_V1_FORWARDER,
        abi: CFA_V1_FORWARDER_ABI,
        functionName: "setFlowrate",
        args: [STREME_SUPER_TOKEN, recipientAddress, flowRateInt96],
      });
      
      return true;
    } catch (error) {
      console.error("Streaming transaction failed:", error);
      setState(prev => ({ 
        ...prev, 
        isStreaming: false, 
        error: error instanceof Error ? error.message : "Transaction failed"
      }));
      return false;
    }
  }, [address, state.selectedFriends, state.streamingSummary, writeContract]);

  // Clear any errors
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset streaming state
  const resetStreaming = useCallback(() => {
    setState({
      selectedFriends: [],
      isStreaming: false,
      streamingSummary: null,
      error: null,
      txHash: null,
    });
  }, []);

  return {
    // State
    selectedFriends: state.selectedFriends,
    streamingSummary: state.streamingSummary,
    isStreaming: isPending || isConfirming || state.isStreaming,
    error: state.error || (writeError?.message),
    txHash: txHash || state.txHash,
    
    // Computed values
    availableFlowRate,
    flowRateLoading,
    canStream: state.selectedFriends.length > 0 && !isPending && !isConfirming && !state.isStreaming && !flowRateLoading,
    
    // Actions
    updateSelectedFriends,
    executeStreaming,
    clearError,
    resetStreaming,
  };
}