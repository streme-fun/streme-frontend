"use client";

import { useState, useEffect, useCallback } from "react";
import SafeImage from "../../../components/SafeImage";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useAccount } from "wagmi";
import { flowRateToTokensPerDay, STREME_SUPER_TOKEN } from "@/src/lib/superfluid-cfa";

interface IncomingStream {
  id: string;
  sender: string;
  currentFlowRate: string;
  createdAtTimestamp: string;
  updatedAtTimestamp: string;
  senderUser?: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
}

export function IncomingStreams() {
  const [incomingStreams, setIncomingStreams] = useState<IncomingStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);
  
  const { address } = useAccount();
  const { isMiniAppView, address: fcAddress } = useAppFrameLogic();
  
  const effectiveAddress = isMiniAppView ? fcAddress : address;

  // Fetch incoming streams where user is the receiver
  const fetchIncomingStreams = useCallback(async () => {
    if (!effectiveAddress) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const query = `
        query GetIncomingStreams($receiver: String!) {
          streams(
            where: {
              receiver: $receiver,
              token: "${STREME_SUPER_TOKEN.toLowerCase()}",
              currentFlowRate_gt: "0"
            },
            orderBy: updatedAtTimestamp,
            orderDirection: desc
          ) {
            id
            sender
            currentFlowRate
            createdAtTimestamp
            updatedAtTimestamp
          }
        }
      `;

      console.log("Fetching incoming streams for:", effectiveAddress);
      
      const response = await fetch(
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            variables: { receiver: effectiveAddress.toLowerCase() },
          }),
        }
      );

      const data = await response.json();
      console.log("Incoming streams response:", data);
      
      if (data.data?.streams) {
        const streamsWithUsers = await Promise.all(
          data.data.streams.map(async (stream: IncomingStream) => {
            // Try to get sender's Farcaster user info
            try {
              const userResponse = await fetch(`/api/users/by-address?address=${stream.sender}`);
              if (userResponse.ok) {
                const userData = await userResponse.json();
                return {
                  ...stream,
                  senderUser: userData.data,
                };
              }
            } catch {
              console.log("Could not fetch sender data for", stream.sender);
            }
            
            return stream;
          })
        );

        setIncomingStreams(streamsWithUsers);
        
        // Calculate total income
        const total = streamsWithUsers.reduce((sum, stream) => {
          return sum + flowRateToTokensPerDay(BigInt(stream.currentFlowRate));
        }, 0);
        setTotalIncome(total);
      }
    } catch (error) {
      console.error("Error fetching incoming streams:", error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveAddress]);

  useEffect(() => {
    fetchIncomingStreams();
  }, [effectiveAddress, fetchIncomingStreams]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="loading loading-spinner loading-md"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Total Income Summary */}
      <div className="text-center py-4 mb-4">
        <div className="text-2xl font-mono font-bold text-success mb-1">
          {totalIncome.toFixed(1)} STREME/day
        </div>
        <div className="text-xs text-base-content/60">
          From {incomingStreams.length} active streams
        </div>
      </div>

      {/* Individual Incoming Streams */}
      {incomingStreams.length > 0 ? (
        <div className="space-y-2">
          {incomingStreams.map((stream) => {
            const tokensPerDay = flowRateToTokensPerDay(BigInt(stream.currentFlowRate));
            
            return (
              <div key={stream.id} className="bg-base-50 rounded-lg p-3 border border-success/20">
                <div className="flex items-center gap-3">
                  {/* Sender Avatar */}
                  <div className="avatar">
                    <div className="w-8 h-8 rounded-full">
                      {stream.senderUser?.pfp_url ? (
                        <SafeImage
                          src={stream.senderUser.pfp_url}
                          alt={stream.senderUser.username}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center">
                          <span className="text-xs font-mono text-success">
                            {stream.sender?.slice(2, 4).toUpperCase() || "??"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stream Info */}
                  <div className="flex-1 min-w-0">
                    {stream.senderUser ? (
                      <div>
                        <div className="font-medium text-xs">
                          @{stream.senderUser.username}
                        </div>
                        {stream.senderUser.display_name && (
                          <div className="text-xs text-base-content/60">
                            {stream.senderUser.display_name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-xs font-mono">
                          {stream.sender.slice(0, 6)}...{stream.sender.slice(-4)}
                        </div>
                        <div className="text-xs text-base-content/60">
                          Wallet Address
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-success">
                      +{tokensPerDay.toFixed(1)}
                    </div>
                    <div className="text-xs text-base-content/60">
                      STREME/day
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-base-content/60 text-sm">
            No incoming streams yet
          </div>
          <div className="text-xs text-base-content/50 mt-1">
            Ask others to stream to you!
          </div>
        </div>
      )}
    </div>
  );
}