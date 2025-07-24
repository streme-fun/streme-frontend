"use client";

import { useState } from "react";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useDistributionPool } from "@/src/hooks/useDistributionPool";
import { BestFriendsGrid } from "@/src/components/BestFriendsGrid";
import { ActiveStreams } from "./components/ActiveStreams";
import { PoolManagement } from "@/src/components/PoolManagement";
import { BestFriend } from "@/src/lib/neynar";
import { toast } from "sonner";
import sdk from "@farcaster/miniapp-sdk";

export default function StreamPage() {
  const [refreshStreams, setRefreshStreams] = useState(0);
  const { 
    isMiniAppView, 
    isConnected, 
    address: fcAddress, 
    farcasterContext,
    isSDKLoaded 
  } = useAppFrameLogic();
  
  const {
    poolState,
    poolAddress,
    selectedFriends,
    dailyAmount,
    error,
    isLoading,
    flowRateLoading,
    canCreatePool,
    canStartStream,
    canStopStream,
    currentFlowRate,
    createPool,
    startStreaming,
    stopStreaming,
    updateSelectedFriends,
    clearError,
    resetPool,
    // Member addition progress
    currentMemberIndex,
    totalMembers,
  } = useDistributionPool();

  const handleFriendSelection = (friends: BestFriend[]) => {
    updateSelectedFriends(friends);
  };

  const handleCreatePool = async () => {
    if (!canCreatePool) {
      toast.error("Unable to create pool");
      return;
    }

    try {
      const success = await createPool(selectedFriends);
      if (success) {
        toast.success(`🏊 Creating distribution pool for ${selectedFriends.length} friends!`);
      }
    } catch (err) {
      console.error("Pool creation failed:", err);
      toast.error("Failed to create pool");
    }
  };

  const handleStartStream = async () => {
    if (!canStartStream) {
      toast.error("Unable to start stream");
      return;
    }

    // Use the actual pool address if available, otherwise show error
    if (!poolAddress) {
      toast.error("Pool address not available. Please recreate the pool.");
      return;
    }
    
    try {
      const success = await startStreaming(poolAddress);
      if (success) {
        const amountPerFriend = selectedFriends.length > 0 
          ? Number(dailyAmount) / selectedFriends.length / 1e18
          : 0;
        toast.success(`🌊 Started streaming ${amountPerFriend.toFixed(0)} STREME daily to each friend!`);
        setRefreshStreams(prev => prev + 1);
      }
    } catch (err) {
      console.error("Start streaming failed:", err);
      toast.error("Failed to start stream");
    }
  };

  const handleStopStream = async () => {
    if (!canStopStream) {
      toast.error("Unable to stop stream");
      return;
    }

    if (!poolAddress) {
      toast.error("Pool address not available.");
      return;
    }
    
    try {
      const success = await stopStreaming(poolAddress);
      if (success) {
        toast.success(`⏹️ Stopped streaming to friends`);
        setRefreshStreams(prev => prev + 1);
      }
    } catch (err) {
      console.error("Stop streaming failed:", err);
      toast.error("Failed to stop stream");
    }
  };

  const handleShare = async () => {
    if (selectedFriends.length === 0) {
      toast.error("Select friends to share about");
      return;
    }

    const friendMentions = selectedFriends
      .map(friend => `@${friend.username}`)
      .join(' ');
    
    const dailyAmountPerFriend = selectedFriends.length > 0 
      ? Math.floor(Number(dailyAmount) / selectedFriends.length / 1e18)
      : 0;
    
    let castText = "";
    
    if (poolState === "none") {
      castText = `🏊 Setting up a daily distribution pool for my best friends: ${friendMentions}!

Each friend gets ${dailyAmountPerFriend} STREME daily 💰

Join me at streme.fun/gda

#STREME #Superfluid`;
    } else if (poolState === "creating") {
      castText = `🏊 Creating distribution pool for my best friends: ${friendMentions}!

Each friend will get ${dailyAmountPerFriend} STREME daily 💰

Setting up automated daily rewards...

#STREME #Superfluid`;
    } else if (poolState === "adding_members") {
      castText = `🏊 Adding friends to my distribution pool: ${friendMentions}!

Setting up ${selectedFriends.length} members for ${dailyAmountPerFriend} STREME daily each 💰

Pool-based automated rewards coming soon!

#STREME #Superfluid`;
    } else if (poolState === "active") {
      castText = `🌊 Currently streaming ${dailyAmountPerFriend} STREME daily to each of my best friends: ${friendMentions}!

Continuous streaming via distribution pool 🏊

Check your streaming balance at streme.fun/gda

#STREME #Superfluid`;
    } else if (poolState === "ready") {
      castText = `🏊 Distribution pool ready for daily STREME streaming to: ${friendMentions}!

Pool set up with ${selectedFriends.length} members • ${dailyAmountPerFriend} STREME daily each 🌊

Ready for continuous streaming!

#STREME #Superfluid`;
    } else if (poolState === "streaming") {
      castText = `🌊 Setting up stream of ${dailyAmountPerFriend} STREME daily to each of my best friends: ${friendMentions}!

Distribution pool streaming starting soon 🏊

#STREME #Superfluid`;
    } else {
      castText = `🏊 Distribution pool for my best friends: ${friendMentions}!

Each friend gets ${dailyAmountPerFriend} STREME daily 💰

#STREME #Superfluid`;
    }

    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: castText,
          embeds: ["https://streme.fun/gda"],
        });
        toast.success("Shared to Farcaster!");
      } catch (error) {
        console.error("Error sharing to Farcaster:", error);
        toast.error("Failed to share to Farcaster");
      }
    } else {
      // Fallback for non-mini-app environments
      console.log("Sharing:", castText);
      toast.success("Share text copied to console!");
    }
  };

  if (!isConnected || !fcAddress) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-semibold mb-4">STREME Streams</h1>
            <p className="text-base-content/70 mb-8">
              Connect your wallet to start streaming STREME tokens to your best friends
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

  if (!farcasterContext?.user?.fid) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-semibold mb-4">STREME Streams</h1>
            <p className="text-base-content/70 mb-8">
              Farcaster account required to access your best friends
            </p>
            <div className="bg-info/10 border border-info/20 rounded-xl p-4">
              <p className="text-info text-sm">
                Please ensure you&apos;re logged in with Farcaster
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isMiniAppView ? "pt-8" : "pt-24"} pb-8`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold mb-2">Daily Friend Rewards</h1>
          <p className="text-sm text-base-content/60">
            Create a distribution pool and send daily STREME rewards to your best friends
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-error/10 border border-error/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-error text-sm">{error}</p>
              <button
                onClick={clearError}
                className="btn btn-ghost btn-xs text-error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Best Friends & Streaming */}
          <div className="lg:col-span-2 space-y-6">
            {/* Weekly Distribution Power */}
            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl border border-primary/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Daily Distribution Pool</h2>
                <div className="text-right">
                  <div className="text-xs text-base-content/60">Available Daily</div>
                  <div className="text-lg font-mono font-bold text-primary">
                    {flowRateLoading ? (
                      <span className="loading loading-dots loading-sm"></span>
                    ) : (
                      `${Math.floor(Number(dailyAmount) / 1e18).toLocaleString()} STREME`
                    )}
                  </div>
                </div>
              </div>
              
              {/* Distribution Summary */}
              {selectedFriends.length > 0 && (
                <div className="bg-base-100/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-base-content/70">
                      Distributing to {selectedFriends.length} friends
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      {Math.floor(Number(dailyAmount) / selectedFriends.length / 1e18)} STREME each
                    </span>
                  </div>
                  <div className="text-xs text-base-content/60">
                    Pool Status: {poolState === "none" ? "Not created" : poolState}
                    {poolState === "active" && currentFlowRate > 0 && (
                      <span className="ml-2 text-success">
                        • Streaming {Math.floor(Number(currentFlowRate * BigInt(86400)) / 1e18)} STREME/day
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Best Friends Grid */}
            <BestFriendsGrid
              userFid={farcasterContext.user.fid}
              onSelectionChange={handleFriendSelection}
              maxSelection={10}
            />

            {/* Pool Action */}
            {selectedFriends.length > 0 && (
              <div className="bg-base-100 rounded-2xl border border-base-300/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold">Daily Distribution Pool</h3>
                    <p className="text-sm text-base-content/60">
                      Equal distribution to {selectedFriends.length} friends • {Math.floor(Number(dailyAmount) / selectedFriends.length / 1e18)} STREME each daily
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  {poolState === "none" && (
                    <button
                      onClick={handleCreatePool}
                      disabled={!canCreatePool}
                      className="btn btn-primary flex-1"
                    >
                      {isLoading ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Creating Pool...
                        </>
                      ) : (
                        <>
                          🏊 Create Distribution Pool
                        </>
                      )}
                    </button>
                  )}
                  
                  {(poolState === "creating" || poolState === "adding_members") && (
                    <button className="btn btn-primary flex-1" disabled>
                      <span className="loading loading-spinner loading-sm"></span>
                      {poolState === "creating" 
                        ? "Creating Pool..." 
                        : `Adding Members... (${currentMemberIndex + 1}/${totalMembers})`
                      }
                    </button>
                  )}
                  
                  {poolState === "ready" && (
                    <button
                      onClick={handleStartStream}
                      disabled={!canStartStream}
                      className="btn btn-primary flex-1"
                    >
                      {isLoading ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Starting Stream...
                        </>
                      ) : (
                        <>
                          🌊 Start Daily Stream
                        </>
                      )}
                    </button>
                  )}
                  
                  {poolState === "active" && (
                    <button
                      onClick={handleStopStream}
                      disabled={!canStopStream}
                      className="btn btn-error flex-1"
                    >
                      {isLoading ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Stopping Stream...
                        </>
                      ) : (
                        <>
                          ⏹️ Stop Stream
                        </>
                      )}
                    </button>
                  )}
                  
                  {poolState === "streaming" && (
                    <button className="btn btn-primary flex-1" disabled>
                      <span className="loading loading-spinner loading-sm"></span>
                      Setting up stream...
                    </button>
                  )}
                  
                  <button
                    onClick={handleShare}
                    className="btn btn-secondary"
                    disabled={selectedFriends.length === 0}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                    </svg>
                    Share
                  </button>
                </div>
                
                <div className="mt-4 p-3 bg-info/5 border border-info/20 rounded-xl">
                  <div className="flex items-start gap-2">
                    <div className="text-info mt-0.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium text-info mb-1">Streaming Pool System</div>
                      <div className="text-base-content/60">
                        {poolState === "none" ? "Create a pool once, then start streaming daily rewards to all friends continuously." :
                         poolState === "ready" ? "Pool is ready for streaming. Start the stream to continuously send tokens to all friends daily." :
                         poolState === "active" ? "Stream is active! Friends are receiving continuous daily rewards." :
                         poolState === "streaming" ? "Setting up the stream..." :
                         "Pool setup in progress..."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Pool Management & Active Streams */}
          <div className="space-y-6">
            {/* Pool Management */}
            <PoolManagement
              poolState={poolState}
              poolAddress={poolAddress}
              selectedFriends={selectedFriends}
              currentMemberIndex={currentMemberIndex}
              totalMembers={totalMembers}
              onResetPool={resetPool}
            />

            {/* Incoming Streams */}
            <div className="bg-base-100 rounded-2xl border border-base-300/50 p-5">
              <h3 className="text-base font-semibold mb-4">Your Streaming Income</h3>
              <div className="text-center py-8">
                <div className="text-2xl font-mono font-bold text-success mb-1">
                  0 STREME/day
                </div>
                <div className="text-xs text-base-content/60">
                  From 0 active streams
                </div>
              </div>
            </div>

            {/* Active Outgoing Streams */}
            <div className="bg-base-100 rounded-2xl border border-base-300/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Your Active Streams</h3>
                <button
                  onClick={() => setRefreshStreams(prev => prev + 1)}
                  className="btn btn-ghost btn-xs"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <ActiveStreams key={refreshStreams} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}