"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Address } from "viem";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useStremeBalance } from "@/src/hooks/useStremeBalance";
// import { useCFAFlowRate } from "@/src/hooks/useCFAFlowRate";
import { useStreamingNumber } from "@/src/hooks/useStreamingNumber";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import sdk from "@farcaster/miniapp-sdk";
import { 
  tokensPerDayToFlowRate, 
  flowRateToTokensPerDay,
  STREME_SUPER_TOKEN 
} from "@/src/lib/superfluid-cfa";
import { CFA_V1_FORWARDER } from "@/src/lib/superfluid-contracts";

// Component for animated streaming amount
function StreamingAmount({ 
  baseAmount, 
  flowRatePerSecond, 
  lastCalculationTime 
}: { 
  baseAmount: number; 
  flowRatePerSecond: number; 
  lastCalculationTime: number; 
}) {
  const animatedAmount = useStreamingNumber({
    baseAmount,
    flowRatePerSecond,
    lastUpdateTime: lastCalculationTime, // Time when baseAmount was calculated
    updateInterval: 33, // ~30fps for smoother animation
    pauseWhenHidden: true,
  });

  // Use more decimal places for small amounts
  const decimalPlaces = animatedAmount < 1 ? 6 : animatedAmount < 100 ? 4 : 2;

  return (
    <span className="font-mono text-success">
      {animatedAmount.toLocaleString(undefined, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      })} STREME
    </span>
  );
}

// Component for animated balance with net flow rate
function AnimatedBalance({ 
  balance, 
  outgoingFlowRatePerDay,
  isLoading 
}: { 
  balance: number; 
  outgoingFlowRatePerDay: number;
  isLoading: boolean; 
}) {
  // Calculate flow rate (negative since it's outgoing)
  const netFlowRatePerSecond = -outgoingFlowRatePerDay / 86400; // Convert daily rate to per-second
  
  const animatedBalance = useStreamingNumber({
    baseAmount: balance,
    flowRatePerSecond: netFlowRatePerSecond,
    lastUpdateTime: Date.now(),
    updateInterval: 33, // ~30fps for smoother animation
    pauseWhenHidden: true,
  });

  if (isLoading) {
    return <span className="loading loading-dots loading-sm"></span>;
  }

  // Use more decimal places for small numbers
  const decimalPlaces = animatedBalance < 1 ? 6 : animatedBalance < 100 ? 4 : 2;

  return (
    <span className="text-2xl font-mono font-bold text-primary">
      {animatedBalance.toLocaleString(undefined, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      })} STREME
    </span>
  );
}

interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
  followingCount: number;
  verifiedEthAddresses: string[];
}

interface ActiveFlow {
  receiver: string;
  receiverUsername?: string;
  receiverUser?: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  };
  flowRate: bigint;
  tokensPerDay: number;
  startedAt: bigint;
  totalStreamed: number;
  calculationTime: number;
}

export default function CFAPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [streamDays, setStreamDays] = useState("7");
  const [totalTokens, setTotalTokens] = useState("700");
  const [activeFlows, setActiveFlows] = useState<ActiveFlow[]>([]);
  const [outgoingFlowRatePerDay, setOutgoingFlowRatePerDay] = useState<number>(0);
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);

  const { address: wagmiAddress } = useAccount();
  const { 
    isMiniAppView, 
    isConnected, 
    address: fcAddress, 
    // farcasterContext,
    isSDKLoaded 
  } = useAppFrameLogic();

  const { balance, isLoading: balanceLoading, refetch: refetchBalance } = useStremeBalance();
  // const { flowRate, isLoading: flowRateLoading, refetch: refetchFlowRate } = useCFAFlowRate();
  const router = useRouter();

  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
  });

  // Search for users by username
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/neynar/search-users?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");
      
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search users");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);


  // Load active flows
  const loadActiveFlows = useCallback(async () => {
    if (!effectiveAddress) {
      console.log("[loadActiveFlows] No effective address available");
      return;
    }

    try {
      // Query Superfluid subgraph for all outgoing streams (using working pattern from GDA)
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

      console.log("[loadActiveFlows] Debug info:", {
        effectiveAddress: effectiveAddress?.toLowerCase(),
        tokenAddress: STREME_SUPER_TOKEN.toLowerCase(),
        queryingSender: effectiveAddress?.toLowerCase()
      });
      console.log("[loadActiveFlows] Query:", query);

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
      console.log("[loadActiveFlows] Subgraph response:", data);
      console.log("[loadActiveFlows] Raw streams data:", data.data?.streams);

      const flows: ActiveFlow[] = [];
      
      if (data.data?.streams) {
        for (const stream of data.data.streams) {
          console.log("[loadActiveFlows] Processing stream:", stream);
          console.log("[loadActiveFlows] Stream receiver:", stream.receiver, typeof stream.receiver);
          
          // Extract receiver from stream ID if not present in the response (like GDA does)
          let receiverAddress = stream.receiver;
          if (!receiverAddress && stream.id) {
            const idParts = stream.id.split('-');
            if (idParts.length >= 2) {
              receiverAddress = idParts[1];
              console.log("[loadActiveFlows] Extracted receiver from ID:", receiverAddress);
              stream.receiver = receiverAddress;
            }
          }
          
          // Add validation to ensure required fields exist
          if (!receiverAddress || !stream.currentFlowRate) {
            console.warn("[loadActiveFlows] Skipping invalid stream:", stream);
            continue;
          }
          
          // Calculate total streamed so far
          const currentTime = Math.floor(Date.now() / 1000);
          const startTime = Number(stream.createdAtTimestamp || "0");
          const secondsElapsed = Math.max(0, currentTime - startTime);
          const flowRatePerSecond = Number(stream.currentFlowRate) / 1e18; // Convert from wei to tokens
          const totalStreamedSoFar = flowRatePerSecond * secondsElapsed;
          
          console.log(`[loadActiveFlows] Stream calculation:`, {
            receiver: receiverAddress,
            flowRateWei: stream.currentFlowRate,
            flowRatePerSecond,
            startTime,
            currentTime,
            secondsElapsed,
            totalStreamedSoFar
          });

          flows.push({
            receiver: receiverAddress,
            receiverUsername: undefined, // Will be set after Neynar lookup
            receiverUser: undefined, // Will be set after Neynar lookup
            flowRate: BigInt(stream.currentFlowRate),
            tokensPerDay: flowRateToTokensPerDay(BigInt(stream.currentFlowRate)),
            startedAt: BigInt(stream.createdAtTimestamp || "0"),
            totalStreamed: totalStreamedSoFar,
            calculationTime: currentTime * 1000, // Store when we calculated totalStreamed (in milliseconds)
          });
        }
      }

      // Fetch Farcaster user data for each receiver
      const flowsWithUsers = await Promise.all(
        flows.map(async (flow) => {
          try {
            console.log("[loadActiveFlows] Looking up user for address:", flow.receiver);
            const userResponse = await fetch(`/api/users/by-address?address=${flow.receiver}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              console.log("[loadActiveFlows] Found user data:", userData);
              return {
                ...flow,
                receiverUsername: userData.data?.username,
                receiverUser: userData.data ? {
                  fid: userData.data.fid,
                  username: userData.data.username,
                  displayName: userData.data.display_name || userData.data.username,
                  pfpUrl: userData.data.pfp_url,
                } : undefined,
              };
            }
          } catch (error) {
            console.log("[loadActiveFlows] Could not fetch user data for", flow.receiver, error);
          }
          return flow;
        })
      );

      console.log("[loadActiveFlows] Setting flows with user data:", flowsWithUsers);
      setActiveFlows(flowsWithUsers);
      
      // Calculate total outgoing flow rate for balance animation
      const totalOutgoingPerDay = flowsWithUsers.reduce((sum, flow) => {
        return sum + flow.tokensPerDay;
      }, 0);
      setOutgoingFlowRatePerDay(totalOutgoingPerDay);
    } catch (error) {
      console.error("[loadActiveFlows] Error loading flows:", error);
    }
  }, [effectiveAddress]);

  useEffect(() => {
    if (effectiveAddress) {
      loadActiveFlows();
    }
  }, [loadActiveFlows, effectiveAddress]);

  // Handle creating a new flow
  const handleCreateFlow = async () => {
    if (!selectedUser || !effectiveAddress) {
      toast.error("Please select a user and connect wallet");
      return;
    }

    if (!selectedUser.verifiedEthAddresses.length) {
      toast.error("Selected user has no verified ETH address");
      return;
    }

    const receiverAddress = selectedUser.verifiedEthAddresses[0] as Address;
    const totalTokensAmount = parseFloat(totalTokens);
    const tokensPerDay = totalTokensAmount / parseInt(streamDays);
    const flowRate = tokensPerDayToFlowRate(tokensPerDay);
    // const durationInSeconds = parseInt(streamDays) * 24 * 60 * 60;

    console.log("Creating flow with params:", {
      token: STREME_SUPER_TOKEN,
      sender: effectiveAddress,
      receiver: receiverAddress,
      flowRate: flowRate.toString(),
      tokensPerDay,
      totalTokensAmount,
      streamDays,
    });

    try {
      if (balance < totalTokensAmount) {
        toast.error(`Insufficient balance. Need ${totalTokensAmount} STREME, have ${balance.toFixed(4)}`);
        return;
      }

      writeContract({
        address: CFA_V1_FORWARDER,
        abi: [
          {
            inputs: [
              { name: "token", type: "address" },
              { name: "sender", type: "address" },
              { name: "receiver", type: "address" },
              { name: "flowrate", type: "int96" },
              { name: "userData", type: "bytes" }
            ],
            name: "createFlow",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function"
          }
        ],
        functionName: "createFlow",
        args: [STREME_SUPER_TOKEN, effectiveAddress, receiverAddress, flowRate, "0x"],
      });

    } catch (error) {
      console.error("Error creating flow:", error);
      toast.error("Failed to create stream");
    }
  };

  // Handle stopping a flow
  const handleStopFlow = async (receiverAddress: string) => {
    if (!effectiveAddress) return;

    try {
      writeContract({
        address: CFA_V1_FORWARDER,
        abi: [
          {
            inputs: [
              { name: "token", type: "address" },
              { name: "sender", type: "address" },
              { name: "receiver", type: "address" },
              { name: "userData", type: "bytes" }
            ],
            name: "deleteFlow",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function"
          }
        ],
        functionName: "deleteFlow",
        args: [STREME_SUPER_TOKEN, effectiveAddress, receiverAddress as Address, "0x"],
      });
    } catch (error) {
      console.error("Error stopping flow:", error);
      toast.error("Failed to stop stream");
    }
  };

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && !hasShownSuccessToast) {
      toast.success("Transaction successful!");
      setHasShownSuccessToast(true);
      refetchBalance();
      loadActiveFlows();
    }
    if (isError) {
      toast.error("Transaction failed");
    }
  }, [isSuccess, isError, hasShownSuccessToast, refetchBalance, loadActiveFlows]);

  // Reset toast state when starting new transaction
  useEffect(() => {
    if (isPending) {
      setHasShownSuccessToast(false);
    }
  }, [isPending]);

  // Share functionality
  const handleShare = async () => {
    if (!selectedUser) return;

    const totalTokensAmount = parseFloat(totalTokens);
    const tokensPerDay = totalTokensAmount / parseInt(streamDays);

    const castText = `🌊 Streaming ${totalTokensAmount} STREME to @${selectedUser.username} over ${streamDays} days!

Rate: ${tokensPerDay.toFixed(2)} STREME per day

Check out streaming at streme.fun/cfa

#STREME #Superfluid`;

    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: castText,
          embeds: ["https://streme.fun/cfa"],
        });
        toast.success("Shared to Farcaster!");
      } catch (error) {
        console.error("Error sharing to Farcaster:", error);
        toast.error("Failed to share to Farcaster");
      }
    } else {
      console.log("Sharing:", castText);
      toast.success("Share text copied to console!");
    }
  };

  if (!isConnected || !effectiveAddress) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-semibold mb-4">STREME Streams (CFA)</h1>
            <p className="text-base-content/70 mb-8">
              Connect your wallet to start streaming STREME tokens to individual users
            </p>
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
              <p className="text-warning text-sm">
                Please connect your wallet to continue
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isMiniAppView ? "pt-8" : "pt-24"} pb-8`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="btn btn-ghost btn-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Individual Streaming (CFA)</h1>
            <p className="text-sm text-base-content/60">
              Stream STREME tokens to individual users with custom duration
            </p>
          </div>
        </div>

        {/* Balance */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl border border-primary/20 p-6 mb-6">
          <div className="text-center">
            <div className="text-xs text-base-content/60 mb-1">Your STREME Balance</div>
            <div>
              <AnimatedBalance
                balance={balance}
                outgoingFlowRatePerDay={outgoingFlowRatePerDay}
                isLoading={balanceLoading}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: User Search & Stream Setup */}
          <div className="space-y-6">
            {/* User Search */}
            <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
              <h3 className="text-base font-semibold mb-4">Search User</h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input input-bordered w-full"
                />

                {isSearching && (
                  <div className="text-center py-4">
                    <span className="loading loading-spinner loading-sm"></span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user.fid}
                        onClick={() => setSelectedUser(user)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedUser?.fid === user.fid
                            ? "border-primary bg-primary/10"
                            : "border-base-300 hover:border-primary/50 hover:bg-base-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={user.pfpUrl}
                            alt={user.displayName}
                            className="w-10 h-10 rounded-full"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{user.displayName}</div>
                            <div className="text-xs text-base-content/60">@{user.username}</div>
                            <div className="text-xs text-base-content/60">
                              {user.followerCount} followers • {user.verifiedEthAddresses.length} verified addresses
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stream Configuration */}
            {selectedUser && (
              <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
                <h3 className="text-base font-semibold mb-4">Stream Configuration</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Streaming to:</label>
                    <div className="p-3 bg-base-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedUser.pfpUrl}
                          alt={selectedUser.displayName}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <div className="font-medium text-sm">{selectedUser.displayName}</div>
                          <div className="text-xs text-base-content/60">@{selectedUser.username}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Total Tokens:</label>
                    <input
                      type="number"
                      value={totalTokens}
                      onChange={(e) => setTotalTokens(e.target.value)}
                      className="input input-bordered w-full"
                      min="1"
                      step="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Duration (Days):</label>
                    <input
                      type="number"
                      value={streamDays}
                      onChange={(e) => {
                        setStreamDays(e.target.value);
                        // Update total tokens to maintain reasonable per-day rate
                        const currentPerDay = parseFloat(totalTokens) / parseInt(streamDays);
                        if (!isNaN(currentPerDay)) {
                          setTotalTokens((currentPerDay * parseInt(e.target.value)).toString());
                        }
                      }}
                      className="input input-bordered w-full"
                      min="1"
                      max="365"
                      step="1"
                    />
                  </div>

                  <div className="bg-info/10 border border-info/20 rounded-xl p-4">
                    <div className="text-sm">
                      <div className="font-medium text-info mb-1">Stream Summary</div>
                      <div className="text-base-content/60">
                        Total: {parseFloat(totalTokens)} STREME over {streamDays} days
                        <br />
                        Rate: {(parseFloat(totalTokens) / parseInt(streamDays)).toFixed(2)} STREME per day
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateFlow}
                      disabled={!selectedUser.verifiedEthAddresses.length || isPending || isConfirming}
                      className="btn btn-primary flex-1"
                    >
                      {isPending || isConfirming ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Creating Stream...
                        </>
                      ) : (
                        <>🌊 Start Stream</>
                      )}
                    </button>

                    <button
                      onClick={handleShare}
                      className="btn btn-secondary"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                      </svg>
                    </button>
                  </div>

                  {!selectedUser.verifiedEthAddresses.length && (
                    <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                      <p className="text-warning text-sm">
                        This user has no verified ETH addresses and cannot receive streams.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Streams */}
          <div className="space-y-6">
            <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Your Active Streams</h3>
                <div className="flex gap-2">
                  <a
                    href={`https://explorer.superfluid.finance/base-mainnet/accounts/${effectiveAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-xs"
                    title="View in Superfluid Explorer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <button
                    onClick={loadActiveFlows}
                    className="btn btn-ghost btn-xs"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {activeFlows.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-base-content/60 text-sm">No active streams</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeFlows.map((flow) => {
                    // Additional safety check
                    if (!flow.receiver) {
                      console.warn("Flow with missing receiver:", flow);
                      return null;
                    }
                    
                    const flowRatePerSecond = Number(flow.flowRate) / 1e18;
                    // const startTime = Number(flow.startedAt);
                    
                    return (
                      <div key={flow.receiver} className="p-4 border border-base-300 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            {/* User Avatar */}
                            <div className="avatar">
                              <div className="w-10 h-10 rounded-full">
                                {flow.receiverUser?.pfpUrl ? (
                                  <img
                                    src={flow.receiverUser.pfpUrl}
                                    alt={flow.receiverUser.username}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-mono">
                                      {flow.receiver.slice(2, 4).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* User Info */}
                            <div className="flex-1 min-w-0">
                              {flow.receiverUser ? (
                                <div>
                                  <div className="font-medium text-sm">
                                    @{flow.receiverUser.username}
                                  </div>
                                  <div className="text-xs text-base-content/60">
                                    {flow.receiverUser.displayName}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-medium text-sm font-mono">
                                    {flow.receiver.slice(0, 6)}...{flow.receiver.slice(-4)}
                                  </div>
                                  <div className="text-xs text-base-content/60">
                                    Wallet Address
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleStopFlow(flow.receiver)}
                            className="btn btn-error btn-xs"
                            disabled={isPending || isConfirming}
                          >
                            Stop
                          </button>
                        </div>

                        {/* Stream Details */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-base-content/60">Rate:</span>
                            <span className="text-sm font-mono text-primary">
                              {flow.tokensPerDay.toFixed(2)} STREME/day
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-base-content/60">Total Streamed:</span>
                            <StreamingAmount
                              baseAmount={flow.totalStreamed}
                              flowRatePerSecond={flowRatePerSecond}
                              lastCalculationTime={flow.calculationTime}
                            />
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-base-content/60">Started:</span>
                            <span className="text-xs text-base-content/60">
                              {new Date(Number(flow.startedAt) * 1000).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}