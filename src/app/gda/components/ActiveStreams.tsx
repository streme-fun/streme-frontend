"use client";

import { useState, useEffect, useCallback } from "react";
import SafeImage from "../../../components/SafeImage";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address, encodeFunctionData } from "viem";
import { 
  flowRateToTokensPerDay, 
  STREME_SUPER_TOKEN 
} from "@/src/lib/superfluid-cfa";
import { CFA_V1, HOST } from "@/src/lib/superfluid-contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { toast } from "sonner";

interface Stream {
  id: string;
  receiver: string;
  currentFlowRate: string;
  createdAtTimestamp: string;
  updatedAtTimestamp: string;
}

interface StreamWithUser extends Stream {
  receiverUser?: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
}

// CFA deleteFlow function ABI
const CFA_DELETE_FLOW_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "receiver", type: "address" },
      { name: "userData", type: "bytes" }
    ],
    name: "deleteFlow",
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

// Separate component for transaction handling to isolate wagmi hook issues
function StreamTransactionHandler({ 
  onStopStream
}: { 
  onStopStream: (writeContractFn: (config: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => void) => void;
}) {
  const { writeContract, data: hash, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Pass writeContract function to parent
  useEffect(() => {
    if (writeContract) {
      onStopStream(writeContract);
    }
  }, [writeContract, onStopStream]);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess) {
      toast.success("Stream stopped successfully!");
      // Refresh streams
      window.location.reload();
    }
  }, [isSuccess]);

  // Handle transaction error
  useEffect(() => {
    if (error) {
      console.error("Transaction error:", error);
      console.error("Error details:", {
        message: error.message,
        cause: error.cause,
        code: error && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : undefined,
        reason: error && typeof error === 'object' && 'reason' in error ? (error as { reason: unknown }).reason : undefined
      });
      
      // Handle user cancellation more gracefully
      if (error.message.includes("User rejected") || error.message.includes("user rejected")) {
        toast.error("Transaction cancelled by user");
      } else if (error.message.includes("insufficient funds")) {
        toast.error("Insufficient funds for transaction");
      } else if (error.message.includes("reverted")) {
        toast.error("Transaction reverted - check stream status");
      } else {
        toast.error(`Failed to stop stream: ${error.message}`);
      }
    }
  }, [error]);

  return null; // This component doesn't render anything
}

export function ActiveStreams() {
  const [streams, setStreams] = useState<StreamWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingStreamId, setDeletingStreamId] = useState<string | null>(null);
  const [writeContractFn, setWriteContractFn] = useState<((config: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => void) | null>(null);
  
  const { address, isConnected } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();

  const effectiveAddress = isMiniAppView ? fcAddress : address;

  // Fetch user's active streams from Superfluid subgraph
  const fetchStreams = useCallback(async (showLoading = true) => {
    if (!effectiveAddress) {
      setIsLoading(false);
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }

    try {
        const query = `
          query GetUserStreams($sender: String!) {
            streams(
              where: {
                sender: $sender,
                token: "${STREME_SUPER_TOKEN.toLowerCase()}",
                currentFlowRate_gt: "0"
              },
              orderBy: updatedAtTimestamp,
              orderDirection: desc
            ) {
              id
              receiver
              currentFlowRate
              createdAtTimestamp
              updatedAtTimestamp
            }
          }
        `;

        console.log("ActiveStreams debug info:", {
          wagmiAddress: address,
          fcAddress: fcAddress,
          isMiniAppView,
          effectiveAddress: effectiveAddress?.toLowerCase(),
          queryingSender: effectiveAddress?.toLowerCase()
        });
        console.log("Query:", query);
        
        const response = await fetch(
          "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              variables: { sender: effectiveAddress.toLowerCase() },
            }),
          }
        );

        const data = await response.json();
        console.log("Subgraph response:", data);
        console.log("Raw streams data:", data.data?.streams);
        
        if (data.data?.streams) {
          const streamsWithUsers = await Promise.all(
            data.data.streams.map(async (stream: Stream) => {
              console.log("Processing stream:", stream);
              console.log("Stream receiver:", stream.receiver, typeof stream.receiver);
              
              // Extract receiver from stream ID if not present in the response
              // Stream ID format: sender-receiver-token-userData
              let receiverAddress = stream.receiver;
              if (!receiverAddress && stream.id) {
                const idParts = stream.id.split('-');
                if (idParts.length >= 2) {
                  receiverAddress = idParts[1];
                  console.log("Extracted receiver from ID:", receiverAddress);
                  // Update the stream object with the extracted receiver
                  stream.receiver = receiverAddress;
                }
              }
              
              // Try to get Farcaster user info for the receiver
              try {
                if (!receiverAddress) {
                  console.log("Stream receiver is falsy, skipping API call");
                  return stream;
                }
                const userResponse = await fetch(`/api/users/by-address?address=${receiverAddress}`);
                if (userResponse.ok) {
                  const userData = await userResponse.json();
                  return {
                    ...stream,
                    receiverUser: userData.data,
                  };
                }
              } catch {
                console.log("Could not fetch user data for", receiverAddress || "undefined receiver");
              }
              
              return stream;
            })
          );

          console.log("Setting streams:", streamsWithUsers);
          setStreams(streamsWithUsers);
        }
    } catch (error) {
      console.error("Error fetching streams:", error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveAddress, address, fcAddress, isMiniAppView]);

  useEffect(() => {
    fetchStreams();
  }, [effectiveAddress, fetchStreams]);

  // Callback to receive writeContract function from transaction handler
  const handleWriteContractReady = useCallback((writeContractFunction: (config: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => void) => {
    setWriteContractFn(() => writeContractFunction);
  }, []);

  const handleStopStream = async (stream: StreamWithUser) => {
    if (!effectiveAddress) {
      console.error("No effective address available");
      return;
    }
    
    if (!stream.receiver) {
      console.error("Cannot stop stream: receiver address is undefined", stream);
      toast.error("Cannot stop stream: invalid receiver address");
      return;
    }

    // Check if we're connected properly
    console.log("Connection state:", {
      address,
      isConnected,
      effectiveAddress,
      isMiniAppView,
      fcAddress
    });

    try {
      setDeletingStreamId(stream.id);

      console.log("Attempting to stop stream:", {
        streamId: stream.id,
        sender: effectiveAddress,
        receiver: stream.receiver,
        token: STREME_SUPER_TOKEN,
        cfaContract: CFA_V1,
        hostContract: HOST
      });

      // Encode the CFA deleteFlow call
      const deleteFlowCallData = encodeFunctionData({
        abi: CFA_DELETE_FLOW_ABI,
        functionName: "deleteFlow",
        args: [
          STREME_SUPER_TOKEN,
          effectiveAddress as Address,
          stream.receiver as Address,
          "0x" // empty userData
        ],
      });

      // Call the Superfluid Host to execute the CFA agreement
      console.log("Calling writeContract with:", {
        address: HOST,
        functionName: "callAgreement",
        args: [CFA_V1, deleteFlowCallData, "0x"]
      });
      
      // Check if writeContract function is available
      if (!writeContractFn) {
        console.error("WriteContract function not available");
        toast.error("Transaction handler not ready - please refresh and try again");
        return;
      }
      
      // Ensure we have proper connection state for transaction
      if (!isConnected) {
        console.error("Not connected to wallet");
        toast.error("Please connect your wallet first");
        return;
      }
      
      if (isMiniAppView && !address) {
        console.error("Mini-app detected but no wagmi address available for transaction");
        toast.error("Wallet connection issue - please refresh and try again");
        return;
      }
      
      // Add a small delay to ensure wagmi state is stable
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log("About to call writeContract...");
      writeContractFn({
        address: HOST,
        abi: HOST_ABI,
        functionName: "callAgreement",
        args: [
          CFA_V1, // CFA agreement class
          deleteFlowCallData,
          "0x" // empty userData
        ],
      });
      
      console.log("writeContract called successfully");

    } catch (error) {
      console.error("Error stopping stream:", error);
      setDeletingStreamId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="loading loading-spinner loading-md"></div>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-base-content/60 mb-2">No active streams</div>
        <div className="text-sm text-base-content/50 mb-2">
          Create your first stream to get started
        </div>
        {!isLoading && (
          <div className="text-xs text-base-content/40 mt-4 p-3 bg-info/10 rounded-lg">
            💡 Just created a stream? It may take a few minutes to appear. Try refreshing in ~30 seconds.
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Transaction handler component - renders invisibly but handles wagmi hooks */}
      <StreamTransactionHandler
        onStopStream={handleWriteContractReady}
      />
      
      <div className="space-y-2">
        {streams.map((stream) => {
        const tokensPerDay = flowRateToTokensPerDay(BigInt(stream.currentFlowRate));
        const isDeleting = deletingStreamId === stream.id;
        
        return (
          <div key={stream.id} className="border border-base-300/50 rounded-xl p-4 hover:bg-base-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                {/* Receiver Avatar */}
                <div className="avatar">
                  <div className="w-8 h-8 rounded-full">
                    {stream.receiverUser?.pfp_url ? (
                      <SafeImage
                        src={stream.receiverUser.pfp_url}
                        alt={stream.receiverUser.username}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-base-300 rounded-full flex items-center justify-center">
                        <span className="text-xs font-mono">
                          {stream.receiver?.slice(2, 4).toUpperCase() || "??"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stream Info */}
                <div className="flex-1 min-w-0">
                  {stream.receiverUser ? (
                    <div>
                      <div className="font-medium text-xs">
                        @{stream.receiverUser.username}
                      </div>
                      {stream.receiverUser.display_name && (
                        <div className="text-xs text-base-content/60">
                          {stream.receiverUser.display_name}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-xs font-mono">
                        {stream.receiver ? `${stream.receiver.slice(0, 6)}...${stream.receiver.slice(-4)}` : (() => {
                          console.warn("Stream with undefined receiver:", stream);
                          return "Unknown Address";
                        })()}
                      </div>
                      <div className="text-xs text-base-content/60">
                        Wallet Address
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm font-mono text-primary mt-1">
                    {tokensPerDay.toFixed(2)} STREME/day
                  </div>
                  
                  <div className="text-xs text-base-content/50">
                    Started {new Date(parseInt(stream.createdAtTimestamp) * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStopStream(stream)}
                  disabled={isDeleting || !writeContractFn}
                  className="btn btn-error btn-xs"
                >
                  {isDeleting ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      <span className="text-xs">Stopping...</span>
                    </>
                  ) : (
                    <span className="text-xs">Stop</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </>
  );
}