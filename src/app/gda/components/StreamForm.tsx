"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address, encodeFunctionData } from "viem";
import { 
  tokensPerDayToFlowRate, 
  getDepositRequired, 
  getRealtimeBalance,
  STREME_SUPER_TOKEN
} from "@/src/lib/superfluid-cfa";
import { CFA_V1, HOST } from "@/src/lib/superfluid-contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { toast } from "sonner";

interface SelectedUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
}

interface StreamFormProps {
  selectedUser: SelectedUser;
  maxFlowRate: number; // Max tokens per day user can stream
  onStreamCreated: () => void;
}


// CFA createFlow function ABI
const CFA_CREATE_FLOW_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "receiver", type: "address" },
      { name: "flowRate", type: "int96" },
      { name: "userData", type: "bytes" }
    ],
    name: "createFlow",
    outputs: [{ name: "newCtx", type: "bytes" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

// Superfluid Host callAgreement ABI
const HOST_ABI = [
  {
    inputs: [
      { name: "agreementClass", type: "address" },
      { name: "callData", type: "bytes" },
      { name: "userData", type: "bytes" }
    ],
    name: "callAgreement",
    outputs: [{ name: "returnedData", type: "bytes" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

export function StreamForm({ selectedUser, maxFlowRate, onStreamCreated }: StreamFormProps) {
  const [flowRate, setFlowRate] = useState("");
  const [duration, setDuration] = useState(""); // Optional duration in days
  const [isLoading, setIsLoading] = useState(false);
  const [requiredDeposit, setRequiredDeposit] = useState<bigint | null>(null);
  const [userBalance, setUserBalance] = useState<bigint | null>(null);
  
  const { address } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const effectiveAddress = isMiniAppView ? fcAddress : address;

  // Calculate required deposit when flow rate changes
  useEffect(() => {
    async function calculateDeposit() {
      if (!flowRate || parseFloat(flowRate) <= 0) {
        setRequiredDeposit(null);
        return;
      }

      try {
        const flowRatePerSecond = tokensPerDayToFlowRate(parseFloat(flowRate));
        const deposit = await getDepositRequired(flowRatePerSecond);
        setRequiredDeposit(deposit as bigint);
      } catch (error) {
        console.error("Error calculating deposit:", error);
      }
    }

    calculateDeposit();
  }, [flowRate]);

  // Get user's current balance
  useEffect(() => {
    async function fetchBalance() {
      if (!effectiveAddress) return;

      try {
        const balance = await getRealtimeBalance(effectiveAddress);
        setUserBalance(balance.availableBalance);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }

    fetchBalance();
  }, [effectiveAddress]);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess) {
      toast.success("Stream created successfully!");
      setFlowRate("");
      setDuration("");
      onStreamCreated();
    }
  }, [isSuccess, onStreamCreated]);

  // Handle transaction error
  useEffect(() => {
    if (error) {
      console.error("Transaction error:", error);
      
      // Handle user cancellation more gracefully
      if (error.message.includes("User rejected") || error.message.includes("user rejected")) {
        toast.error("Transaction cancelled by user");
      } else if (error.message.includes("insufficient funds")) {
        toast.error("Insufficient funds for transaction");
      } else {
        toast.error("Failed to create stream: " + error.message);
      }
    }
  }, [error]);

  const handleCreateStream = async () => {
    if (!effectiveAddress || !flowRate || parseFloat(flowRate) <= 0) {
      toast.error("Please enter a valid flow rate");
      return;
    }

    if (parseFloat(flowRate) > maxFlowRate) {
      toast.error(`Flow rate cannot exceed ${maxFlowRate} STREME/day`);
      return;
    }

    // Use custody address if available, otherwise try verified addresses
    let receiverAddress = selectedUser.custody_address;
    
    // Fallback to first verified Ethereum address if custody address is not available
    if (!receiverAddress && selectedUser.verified_addresses?.eth_addresses?.length > 0) {
      receiverAddress = selectedUser.verified_addresses.eth_addresses[0];
    }
    
    if (!receiverAddress) {
      toast.error("Selected user doesn't have a verified wallet address");
      return;
    }

    // Check if user has sufficient balance
    if (userBalance !== null && requiredDeposit !== null) {
      if (userBalance < requiredDeposit) {
        toast.error(`Insufficient STREME balance. Required: ${(Number(requiredDeposit) / 1e18).toFixed(4)} STREME`);
        return;
      }
    }

    try {
      setIsLoading(true);

      const flowRatePerSecond = tokensPerDayToFlowRate(parseFloat(flowRate));
      
      console.log("Creating stream with:", {
        sender: effectiveAddress,
        receiver: receiverAddress,
        flowRate: parseFloat(flowRate),
        flowRatePerSecond: flowRatePerSecond.toString(),
        userBalance: userBalance ? (Number(userBalance) / 1e18).toFixed(4) : 'unknown',
        requiredDeposit: requiredDeposit ? (Number(requiredDeposit) / 1e18).toFixed(4) : 'unknown'
      });
      
      console.log("Stream creation addresses:", {
        wagmiAddress: address,
        fcAddress: fcAddress,
        isMiniAppView,
        effectiveAddress,
        streamSender: effectiveAddress
      });
      
      // Encode the CFA createFlow call
      const createFlowCallData = encodeFunctionData({
        abi: CFA_CREATE_FLOW_ABI,
        functionName: "createFlow",
        args: [
          STREME_SUPER_TOKEN,
          receiverAddress as Address,
          flowRatePerSecond,
          "0x" // empty userData
        ],
      });

      // Call the Superfluid Host to execute the CFA agreement
      writeContract({
        address: HOST,
        abi: HOST_ABI,
        functionName: "callAgreement",
        args: [
          CFA_V1, // CFA agreement class
          createFlowCallData,
          "0x" // empty userData
        ],
      });

    } catch (error) {
      console.error("Error creating stream:", error);
      toast.error("Failed to create stream");
    } finally {
      setIsLoading(false);
    }
  };

  const flowRateNum = parseFloat(flowRate) || 0;
  const isValidFlowRate = flowRateNum > 0 && flowRateNum <= maxFlowRate;

  return (
    <div className="space-y-4">
      {/* Selected User Display */}
      <div className="bg-base-200/50 rounded-xl p-3">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 h-10 rounded-full">
              {selectedUser.pfp_url ? (
                <Image
                  src={selectedUser.pfp_url}
                  alt={selectedUser.username}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-mono">
                    {selectedUser.username[0]?.toUpperCase() || "?"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="font-medium text-sm">@{selectedUser.username}</div>
            {selectedUser.display_name && selectedUser.display_name !== selectedUser.username && (
              <div className="text-xs text-base-content/70">{selectedUser.display_name}</div>
            )}
            <div className="text-xs text-base-content/50">
              FID: {selectedUser.fid}
            </div>
          </div>
        </div>
      </div>

      {/* Flow Rate Input */}
      <div>
        <label className="block text-xs font-medium mb-2 text-base-content/60">
          Flow Rate (STREME per day)
        </label>
        <div className="relative">
          <input
            type="number"
            placeholder="Enter flow rate"
            value={flowRate}
            onChange={(e) => setFlowRate(e.target.value)}
            min="0"
            max={maxFlowRate}
            step="0.01"
            className={`input input-bordered w-full ${
              flowRate && !isValidFlowRate ? "input-error" : ""
            }`}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-base-content/60">
            STREME/day
          </div>
        </div>
        {flowRate && !isValidFlowRate && (
          <div className="text-error text-sm mt-1">
            Flow rate must be between 0 and {maxFlowRate} STREME/day
          </div>
        )}
        <div className="text-xs text-base-content/60 mt-1">
          Available: {maxFlowRate} STREME/day from your staking rewards
        </div>
      </div>

      {/* Duration Input (Optional) */}
      <div>
        <label className="block text-xs font-medium mb-2 text-base-content/60">
          Duration (optional)
        </label>
        <input
          type="number"
          placeholder="Leave empty for continuous stream"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          min="1"
          step="1"
          className="input input-bordered w-full"
        />
        <div className="text-xs text-base-content/60 mt-1">
          Specify number of days, or leave empty for continuous streaming
        </div>
      </div>

      {/* Deposit and Balance Info */}
      {requiredDeposit !== null && (
        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <div className="text-sm">
            <div className="font-medium mb-2">Transaction Details</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Required Deposit:</span>
                <span className="font-mono">
                  {(Number(requiredDeposit) / 1e18).toFixed(4)} STREME
                </span>
              </div>
              {userBalance !== null && (
                <div className="flex justify-between">
                  <span>Your Balance:</span>
                  <span className="font-mono">
                    {(Number(userBalance) / 1e18).toFixed(4)} STREME
                  </span>
                </div>
              )}
              {flowRate && (
                <div className="flex justify-between">
                  <span>Per Second:</span>
                  <span className="font-mono text-xs">
                    {(parseFloat(flowRate) / (24 * 60 * 60)).toFixed(8)} STREME/sec
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Stream Button */}
      <button
        onClick={handleCreateStream}
        disabled={!isValidFlowRate || isLoading || isPending || isConfirming}
        className="btn btn-primary w-full"
      >
        {isLoading || isPending || isConfirming ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            {isPending ? "Confirm in wallet..." : isConfirming ? "Creating stream..." : "Processing..."}
          </>
        ) : (
          "Create Stream"
        )}
      </button>

      {/* Help Text */}
      <div className="text-xs text-base-content/60">
        <p>
          Streams are continuous and real-time. The recipient will receive tokens every second
          until you stop the stream. A small deposit is required for security.
        </p>
      </div>
    </div>
  );
}