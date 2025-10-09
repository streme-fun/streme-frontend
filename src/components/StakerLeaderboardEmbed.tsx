"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSafeWallets, useSafeWalletAuth } from "../hooks/useSafeWallet";
import { parseEther, formatEther } from "viem";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { ensureTxHash } from "@/src/lib/ensureTxHash";
import sdk from "@farcaster/miniapp-sdk";
import { useWalletAddressChange } from "@/src/hooks/useWalletSync";

interface TokenStaker {
  account: {
    id: string;
  };
  units: string;
  isConnected: boolean;
  createdAtTimestamp: string;
  farcasterUser?: FarcasterUser;
}

interface FarcasterUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

interface StakerLeaderboardEmbedProps {
  stakingPoolAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  stakingAddress?: string;
  onViewAll: () => void;
  onStakingChange?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
  tokenPrice?: number;
  userStakedBalance?: bigint;
}

export function StakerLeaderboardEmbed({
  tokenAddress,
  tokenSymbol,
  stakingAddress,
  onViewAll,
  onStakingChange,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
  tokenPrice,
  userStakedBalance,
}: StakerLeaderboardEmbedProps) {
  const [stakers, setStakers] = useState<TokenStaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isZapStaking, setIsZapStaking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { wallets } = useSafeWallets();
  const { user: connectedUser } = useSafeWalletAuth();
  const { primaryAddress } = useWalletAddressChange();

  // Constants for zap contract
  const WETH = "0x4200000000000000000000000000000000000006";
  const toHex = (address: string) => address as `0x${string}`;

  // Get effective connection state and address
  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!connectedUser?.wallet?.address;
  const effectiveAddress = isMiniApp
    ? farcasterAddress
    : primaryAddress || connectedUser?.wallet?.address;

  const fetchTopStakers = useCallback(async () => {
    if (!tokenAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/token/${tokenAddress.toLowerCase()}/stakers`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch stakers: ${response.statusText}`);
      }

      const stakersData = await response.json();

      // Transform the API response to match the expected format and take top 10
      const transformedStakers: TokenStaker[] = stakersData
        .filter(
          (staker: { holder_address?: string; isStaker?: boolean }) =>
            staker.holder_address &&
            staker.isStaker &&
            staker.holder_address.toLowerCase() !== "0xc749105bc4b4ea6285dbbe2e8221c922bea07a9d"
        ) // Filter out entries without address, non-stakers, and specific excluded address
        .slice(0, 10)
        .map(
          (staker: {
            holder_address: string;
            staked_balance?: number;
            isConnected?: boolean;
            lastUpdated?: {
              _seconds: number;
              _nanoseconds: number;
            };
            farcaster?: {
              fid: number;
              username: string;
              display_name?: string;
              pfp_url: string;
            };
          }) => ({
            account: {
              id: staker.holder_address,
            },
            units: (staker.staked_balance ?? 0).toString(),
            isConnected: staker.isConnected ?? false,
            createdAtTimestamp: staker.lastUpdated?._seconds?.toString() || "0",
            farcasterUser: staker.farcaster
              ? {
                  fid: staker.farcaster.fid,
                  username: staker.farcaster.username,
                  display_name:
                    staker.farcaster.display_name || staker.farcaster.username,
                  pfp_url: staker.farcaster.pfp_url,
                }
              : undefined,
          })
        );

      setStakers(transformedStakers);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching stakers:", err);
      setError("Failed to fetch stakers");
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    if (tokenAddress) {
      fetchTopStakers();
    }

    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      if (tokenAddress) {
        fetchTopStakers();
      }
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchTopStakers, tokenAddress]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchTopStakers();
      toast.success("Staker data refreshed!");
    } catch {
      toast.error("Failed to refresh staker data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Zapstake function
  const handleZapStake = async () => {
    if (!stakingAddress || !effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected or staking address missing");
      return;
    }

    setIsZapStaking(true);
    const toastId = toast.loading("Buying and Staking amount for #1...");

    try {
      const amountIn = getEthAmountForStaking();
      const amountInWei = parseEther(amountIn);

      // 1. Get quote
      const quoterAddress = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
      const quoterAbi = [
        {
          inputs: [
            {
              components: [
                { name: "tokenIn", type: "address" },
                { name: "tokenOut", type: "address" },
                { name: "amountIn", type: "uint256" },
                { name: "fee", type: "uint24" },
                { name: "sqrtPriceLimitX96", type: "uint160" },
              ],
              name: "params",
              type: "tuple",
            },
          ],
          name: "quoteExactInputSingle",
          outputs: [
            { name: "amountOut", type: "uint256" },
            { name: "sqrtPriceX96After", type: "uint160" },
            { name: "initializedTicksCrossed", type: "uint32" },
            { name: "gasEstimate", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ];
      const quoteResult = (await publicClient.readContract({
        address: quoterAddress as `0x${string}`,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: WETH,
            tokenOut: toHex(tokenAddress),
            amountIn: amountInWei,
            fee: 10000,
            sqrtPriceLimitX96: 0n,
          },
        ],
      })) as [bigint, bigint, number, bigint];
      const amountOut = quoteResult[0];
      const amountOutMin = amountOut - amountOut / 200n; // 0.5% slippage

      const zapContractAddress = "0xeA25b9CD2D9F8Ba6cff45Ed0f6e1eFa2fC79a57E";
      const zapAbi = [
        "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256)",
      ];
      const zapIface = new Interface(zapAbi);
      const zapData = zapIface.encodeFunctionData("zap", [
        toHex(tokenAddress),
        amountInWei,
        amountOutMin,
        toHex(stakingAddress),
      ]) as `0x${string}`;

      let txHash: `0x${string}`;

      if (isMiniApp) {
        const ethProvider = await sdk.wallet.getEthereumProvider();
        if (!ethProvider)
          throw new Error("Farcaster Ethereum provider not available.");
        const currentEthBalance = await publicClient.getBalance({
          address: toHex(effectiveAddress!),
        });
        if (currentEthBalance < amountInWei) {
          throw new Error(
            `Insufficient ETH. You have ${formatEther(
              currentEthBalance
            )} ETH, need ${formatEther(
              amountInWei
            )} ETH for zap (excluding gas).`
          );
        }
        const rawTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(zapContractAddress),
              from: toHex(effectiveAddress!),
              data: zapData,
              value: `0x${amountInWei.toString(16)}`,
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });
        txHash = ensureTxHash(rawTxHash, "Farcaster Ethereum provider");
      } else {
        if (!connectedUser?.wallet?.address)
          throw new Error("Wallet not connected.");

        // Simplified wallet access
        const wallet = wallets?.[0];
        if (!wallet) throw new Error("No wallet available");

        const walletAddress = wallet.address;
        if (!walletAddress) throw new Error("Wallet address not available");

        const provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
        let estimatedGas = 1200000n;
        try {
          estimatedGas = await publicClient.estimateGas({
            account: toHex(walletAddress),
            to: toHex(zapContractAddress),
            value: amountInWei,
            data: zapData,
          });
        } catch (e) {
          console.error("Gas estimation failed (wallet connector):", e);
        }
        const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.2));
        const currentEthBalance = await publicClient.getBalance({
          address: toHex(walletAddress),
        });
        const gasPrice = await publicClient.getGasPrice();
        const totalCost = gasLimit * gasPrice + amountInWei;
        if (currentEthBalance < totalCost) {
          throw new Error(
            `Insufficient ETH. Need ~${formatEther(
              totalCost
            )} ETH (inc. gas), have ${formatEther(currentEthBalance)} ETH.`
          );
        }
        const rawTxHash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(zapContractAddress),
              from: toHex(walletAddress),
              data: zapData,
              value: `0x${amountInWei.toString(16)}`,
              gas: `0x${gasLimit.toString(16)}`,
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });
        txHash = ensureTxHash(rawTxHash, "Wallet connector provider");
      }

      if (!txHash) {
        throw new Error(
          "Transaction hash not received. User might have cancelled."
        );
      }

      toast.loading("Waiting for transaction confirmation...", { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status !== "success") {
        throw new Error(
          `Transaction failed or reverted. Status: ${receipt.status}`
        );
      }

      const ethAmount = parseFloat(amountIn).toFixed(4);
      toast.success(
        `🏆 Congrats! You're now the top staker with ${ethAmount} ETH!`,
        {
          id: toastId,
          duration: 5000,
        }
      );

      // Wait 2 seconds before refreshing to allow blockchain state to update
      setTimeout(() => {
        fetchTopStakers();
        onStakingChange?.();
      }, 1000);
    } catch (error: unknown) {
      console.error("ZapStake caught error:", error);
      let message = "Zap & Stake failed. Please try again.";

      if (typeof error === "object" && error !== null) {
        if (
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ) {
          const errorMessage = (error as { message: string }).message;
          if (
            errorMessage.includes("User rejected") ||
            errorMessage.includes("cancelled")
          ) {
            message = "Transaction rejected by user.";
          } else if (errorMessage.includes("Insufficient ETH")) {
            message = errorMessage;
          } else if (errorMessage.includes("Transaction hash not received")) {
            message = "Transaction cancelled or not initiated.";
          } else {
            message = errorMessage.substring(0, 100);
          }
        }
      }
      toast.error(message, { id: toastId });
    } finally {
      setIsZapStaking(false);
    }
  };

  if (loading) {
    return (
      <div className="card bg-base-100 border-base-300 border-2 p-4">
        <h3 className="text-lg font-bold mb-4">Top Stakers</h3>
        <div className="flex justify-center items-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-base-100 border-base-300 border-2 p-4">
        <h3 className="text-lg font-bold mb-4">Top Stakers</h3>
        <div className="text-center py-4">
          <p className="text-error text-sm mb-2">{error}</p>
          <button onClick={fetchTopStakers} className="btn btn-primary btn-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 border-base-300 border-2 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Top ${tokenSymbol} Stakers</h3>
        <div className="flex items-center gap-2">
          {/* Manual refresh button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            className="btn btn-ghost btn-sm"
            title="Refresh staker data"
          >
            {isRefreshing ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </button>

          {/* View All button */}
          {stakers.length > 0 && (
            <button onClick={onViewAll} className="btn btn-outline btn-sm">
              View All
            </button>
          )}
        </div>
      </div>

      {stakers.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-base-content/50 text-sm">No stakers yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stakers.map((staker, index) => (
            <div
              key={`${staker.account.id}-${index}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 transition-colors"
            >
              {/* Rank */}
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {index + 1}
              </div>

              {/* Profile */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Special handling for crowdfund address */}
                {staker.account.id?.toLowerCase() ===
                "0xceacfbb5a17b6914051d12d8c91d3461382d503b" ? (
                  <>
                    <div className="avatar">
                      <div className="mask mask-squircle w-6 h-6">
                        <img src="/icon.png" alt="Streme Crowdfund" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        <Link
                          href="/crowdfund"
                          className="hover:underline text-secondary"
                        >
                          Crowdfund
                        </Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {staker.farcasterUser?.pfp_url && (
                      <div className="avatar">
                        <div className="mask mask-squircle w-6 h-6">
                          <img
                            src={staker.farcasterUser.pfp_url}
                            alt={staker.farcasterUser.username || "User"}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {staker.farcasterUser?.username ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (isMiniApp) {
                              sdk.actions.openUrl(
                                `https://farcaster.xyz/${
                                  staker.farcasterUser!.username
                                }`
                              );
                            } else {
                              window.open(
                                `https://farcaster.xyz/${
                                  staker.farcasterUser!.username
                                }`,
                                "_blank"
                              );
                            }
                          }}
                          className="text-sm font-medium hover:text-primary hover:underline text-left cursor-pointer"
                        >
                          @{staker.farcasterUser.username}
                        </button>
                      ) : (
                        <div className="font-mono text-xs text-primary">
                          <a
                            href={`https://basescan.org/address/${staker.account.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {staker.account.id
                              ? `${staker.account.id.slice(
                                  0,
                                  6
                                )}...${staker.account.id.slice(-4)}`
                              : "Unknown"}
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Staked Amount */}
              <div className="text-right">
                <div className="font-mono text-sm font-medium">
                  {parseInt(staker.units).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Become Top Staker Button */}
      {stakingAddress && !isUserTopStaker() && effectiveIsConnected && (
        <div className="mt-3 pt-3 border-t border-base-300">
          <div className="text-center">
            <button
              onClick={handleZapStake}
              disabled={isZapStaking}
              className="btn btn-primary btn-sm w-full"
            >
              {isZapStaking ? (
                <span className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-xs"></span>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  {stakers.length > 0
                    ? "🏆 Become Top Staker"
                    : "🚀 Be First Staker"}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Helper function to check if current user is already top staker
  function isUserTopStaker(): boolean {
    if (!effectiveAddress || stakers.length === 0) return false;
    return (
      stakers[0]?.account?.id?.toLowerCase() === effectiveAddress.toLowerCase()
    );
  }

  // Helper function to calculate amount needed to beat top staker (formatted for display)
  // function getAmountToBeatTopStaker(): string {
  //   if (stakers.length === 0) return "1";

  //   const topStakerUnits = parseFloat(stakers[0]?.units || "0");
  //   const amountNeeded = Math.max(1, topStakerUnits + 10000); // Add 10,000 as requested, minimum 1

  //   // Format the number appropriately
  //   if (amountNeeded >= 1000000) {
  //     return `${(amountNeeded / 1000000).toFixed(1)}M`;
  //   } else if (amountNeeded >= 1000) {
  //     return `${(amountNeeded / 1000).toFixed(1)}K`;
  //   } else {
  //     return Math.ceil(amountNeeded).toLocaleString();
  //   }
  // }

  // Helper function to get raw amount for ZapStakeButton
  // This calculates how many MORE tokens the user needs to buy/stake
  function getAmountToBeatTopStakerRaw(): string {
    if (stakers.length === 0) return "1";

    const topStakerUnits = parseFloat(stakers[0]?.units || "0");
    const targetAmount = topStakerUnits + 10000; // Target: top staker + 10,000

    // Get user's current staked balance
    const userCurrentStaked = userStakedBalance
      ? Number(userStakedBalance) / 1e18
      : 0;

    // Calculate how much more they need
    const additionalNeeded = Math.max(1, targetAmount - userCurrentStaked);

    return Math.ceil(additionalNeeded).toString();
  }

  // Helper function to get ETH amount for ZapStakeButton
  // Converts the required token amount to ETH using token price
  function getEthAmountForStaking(): string {
    if (stakers.length === 0) return "0.001"; // Default small amount for first staker

    const tokensNeeded = parseFloat(getAmountToBeatTopStakerRaw());

    if (tokenPrice && tokenPrice > 0) {
      // Calculate USD value of tokens needed
      const usdValue = tokensNeeded * tokenPrice;

      // Convert to ETH (assuming ETH = ~$3000, but could fetch real ETH price)
      // For now, use a reasonable ETH price estimate
      const ethPrice = 3000; // Could be fetched dynamically
      const ethNeeded = usdValue / ethPrice;

      // Add 20% buffer for slippage and price movements
      const ethWithBuffer = ethNeeded * 1.2;

      // Cap at reasonable amounts for safety
      const cappedEth = Math.min(ethWithBuffer, 1.0);
      const finalEth = Math.max(0.001, cappedEth);

      return finalEth.toFixed(4);
    }

    // Fallback if no token price available - use reasonable defaults
    const topStakerAmount = parseFloat(stakers[0]?.units || "0");
    if (topStakerAmount > 1000000) {
      return "0.1"; // Large amounts
    } else if (topStakerAmount > 100000) {
      return "0.05"; // Medium amounts
    } else if (topStakerAmount > 10000) {
      return "0.01"; // Small amounts
    } else {
      return "0.005"; // Very small amounts
    }
  }
}
