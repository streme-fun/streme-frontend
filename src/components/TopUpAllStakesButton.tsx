"use client";

import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { toast } from "sonner";
import { sdk } from "@farcaster/frame-sdk";
import { formatUnits } from "viem";
import { TopUpStakeSelectionModal } from "./TopUpStakeSelectionModal";

const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";

const gdaABI = [
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "member", type: "address" },
    ],
    name: "isMemberConnected",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const erc20ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

const toHex = (address: string) => address as `0x${string}`;

interface StakeData {
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  symbol: string;
  balance: bigint;
}

interface TopUpAllStakesButtonProps {
  stakes: Array<{
    tokenAddress: string;
    stakingAddress: string;
    stakingPoolAddress: string;
    baseAmount: number;
    streamedAmount: number;
    membership: {
      pool: {
        token: {
          symbol: string;
        };
      };
    };
  }>;
  disabled?: boolean;
  className?: string;
  onSuccess?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
}

export function TopUpAllStakesButton({
  stakes,
  disabled,
  className,
  onSuccess,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
}: TopUpAllStakesButtonProps) {
  const { wallets } = useWallets();
  const { address: wagmiAddress } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({
    current: 0,
    total: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preparedStakes, setPreparedStakes] = useState<
    Array<{
      tokenAddress: string;
      stakingAddress: string;
      stakingPoolAddress: string;
      symbol: string;
      balance: bigint;
    }>
  >([]);

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!wagmiAddress;
  const effectiveAddress = isMiniApp ? farcasterAddress : wagmiAddress;

  const checkAllowance = async (
    tokenAddress: string,
    stakingAddress: string
  ) => {
    if (!effectiveAddress || !effectiveIsConnected) return 0n;
    try {
      const allowance = await publicClient.readContract({
        address: toHex(tokenAddress),
        abi: erc20ABI,
        functionName: "allowance",
        args: [toHex(effectiveAddress!), toHex(stakingAddress)],
      });
      return allowance;
    } catch (error) {
      console.error("Error checking allowance:", error);
      return 0n;
    }
  };

  const executeStakeOperation = async (
    stakeData: StakeData,
    provider: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    userAddress: string,
    toastId: string | number,
    current: number,
    total: number
  ) => {
    const {
      tokenAddress,
      stakingAddress,
      stakingPoolAddress,
      symbol,
      balance,
    } = stakeData;

    if (balance === 0n) {
      console.log(`Skipping ${symbol} - no balance available`);
      return;
    }

    // Update progress
    setCurrentProgress({ current, total });

    const progressText = `${current}/${total}`;
    const progressPercentage = Math.round((current / total) * 100);

    toast.loading(
      `[${progressText}] Processing ${symbol} (${formatUnits(balance, 18).slice(
        0,
        8
      )}...) - ${progressPercentage}% complete`,
      { id: toastId }
    );

    // Check and approve if needed
    const currentAllowance = await checkAllowance(tokenAddress, stakingAddress);
    if (currentAllowance < balance) {
      toast.loading(
        `[${progressText}] Approving ${symbol}... - ${progressPercentage}% complete`,
        { id: toastId }
      );
      const approveIface = new Interface([
        "function approve(address spender, uint256 amount) external returns (bool)",
      ]);
      const approveData = approveIface.encodeFunctionData("approve", [
        toHex(stakingAddress),
        MAX_UINT256,
      ]);

      const approveTxHash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: toHex(tokenAddress),
            from: toHex(userAddress),
            data: toHex(approveData),
          },
        ],
      });

      if (!approveTxHash) {
        throw new Error(`Approval for ${symbol} was cancelled`);
      }

      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash as `0x${string}`,
      });

      if (approveReceipt.status !== "success") {
        throw new Error(`Approval for ${symbol} failed`);
      }
    }

    // Execute stake
    toast.loading(
      `[${progressText}] Staking ${symbol}... - ${progressPercentage}% complete`,
      { id: toastId }
    );
    const stakeIface = new Interface([
      "function stake(address to, uint256 amount) external",
    ]);
    const stakeData_encoded = stakeIface.encodeFunctionData("stake", [
      toHex(userAddress),
      balance,
    ]);

    const stakeTxParams: Record<string, unknown> = {
      to: toHex(stakingAddress),
      from: toHex(userAddress),
      data: toHex(stakeData_encoded),
    };

    // Add gas estimation for non-miniApp
    if (!isMiniApp) {
      try {
        const estimatedGas = await publicClient.estimateGas({
          account: userAddress as `0x${string}`,
          to: toHex(stakingAddress),
          data: stakeData_encoded as `0x${string}`,
        });
        const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.5));
        stakeTxParams.gas = `0x${gasLimit.toString(16)}`;
      } catch {
        console.warn(
          `Gas estimation failed for ${symbol}, proceeding without limit`
        );
      }
    }

    const stakeTxHash = await provider.request({
      method: "eth_sendTransaction",
      params: [stakeTxParams],
    });

    if (!stakeTxHash) {
      throw new Error(`Stake transaction for ${symbol} was cancelled`);
    }

    const stakeReceipt = await publicClient.waitForTransactionReceipt({
      hash: stakeTxHash as `0x${string}`,
    });

    if (stakeReceipt.status !== "success") {
      throw new Error(`Stake transaction for ${symbol} failed`);
    }

    // Connect to pool if needed and available
    if (
      stakingPoolAddress &&
      stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
    ) {
      try {
        const connected = await publicClient.readContract({
          address: toHex(GDA_FORWARDER),
          abi: gdaABI,
          functionName: "isMemberConnected",
          args: [toHex(stakingPoolAddress), toHex(userAddress)],
        });

        if (!connected) {
          toast.loading(
            `[${progressText}] Connecting ${symbol} to reward pool... - ${progressPercentage}% complete`,
            {
              id: toastId,
            }
          );
          const gdaIface = new Interface([
            "function connectPool(address pool, bytes calldata userData) external returns (bool)",
          ]);
          const connectData = gdaIface.encodeFunctionData("connectPool", [
            toHex(stakingPoolAddress),
            "0x",
          ]);

          const connectTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(GDA_FORWARDER),
                from: toHex(userAddress),
                data: toHex(connectData),
              },
            ],
          });

          if (connectTxHash) {
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash as `0x${string}`,
            });
          }
        }
      } catch (poolError) {
        console.warn(`Pool connection failed for ${symbol}:`, poolError);
        // Don't fail the entire operation for pool connection issues
      }
    }

    // Show individual success with progress
    toast.success(
      `[${progressText}] ${symbol} staked successfully! - ${progressPercentage}% complete`,
      {
        id: toastId,
        duration: 2000,
      }
    );
  };

  const handleTopUpSelected = async (
    selectedStakes: Array<{
      tokenAddress: string;
      stakingAddress: string;
      stakingPoolAddress: string;
      symbol: string;
      balance: bigint;
    }>
  ) => {
    if (!effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected");
      return;
    }

    if (selectedStakes.length === 0) {
      toast.error("No tokens selected");
      return;
    }

    setIsLoading(true);
    setCurrentProgress({ current: 0, total: 0 });
    const toastId = toast.loading("Preparing transactions...");

    try {
      // Initialize progress
      const totalCount = selectedStakes.length;
      setCurrentProgress({ current: 0, total: totalCount });

      toast.loading(`Processing ${totalCount} selected token(s)...`, {
        id: toastId,
      });

      // Get provider
      let provider: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      let userAddress: string;

      if (isMiniApp) {
        provider = sdk.wallet.ethProvider;
        if (!provider) {
          throw new Error("Farcaster Ethereum provider not available");
        }
        userAddress = effectiveAddress!;
      } else {
        if (!wagmiAddress) {
          throw new Error("Wagmi wallet not connected");
        }
        userAddress = wagmiAddress;
        const wallet = wallets.find((w) => w.address === wagmiAddress);
        if (!wallet) {
          throw new Error("Wallet not found");
        }
        provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      }

      // Execute stakes one by one
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      let wasCancelled = false;

      for (let i = 0; i < selectedStakes.length; i++) {
        const stakeData = selectedStakes[i];
        const currentIndex = i + 1;

        try {
          await executeStakeOperation(
            stakeData,
            provider,
            userAddress,
            toastId,
            currentIndex,
            totalCount
          );
          successCount++;
        } catch (error) {
          errorCount++;
          const errorMessage =
            error instanceof Error
              ? error.message
              : `Failed to stake ${stakeData.symbol}`;
          errors.push(errorMessage);
          console.error(`Failed to stake ${stakeData.symbol}:`, error);

          // Check if the error indicates user cancellation
          const isCancellation =
            errorMessage.includes("cancelled") ||
            errorMessage.includes("rejected") ||
            errorMessage.includes("User rejected") ||
            errorMessage.includes("hash not received") ||
            errorMessage.includes("User denied");

          if (isCancellation) {
            wasCancelled = true;
            // Show cancellation message and stop processing
            const progressText = `${currentIndex}/${totalCount}`;
            toast.error(
              `[${progressText}] Transaction cancelled - stopping batch operation`,
              {
                duration: 3000,
              }
            );
            break; // Exit the loop immediately
          } else {
            // Show individual error with progress for non-cancellation errors
            const progressText = `${currentIndex}/${totalCount}`;
            const progressPercentage = Math.round(
              (currentIndex / totalCount) * 100
            );
            toast.error(
              `[${progressText}] Failed to stake ${stakeData.symbol} - ${progressPercentage}% complete`,
              {
                duration: 3000,
              }
            );
          }
        }

        // Update progress after each operation
        setCurrentProgress({ current: currentIndex, total: totalCount });
      }

      // Final summary
      if (wasCancelled) {
        const remainingCount = totalCount - successCount - errorCount;
        toast.warning(
          `❌ Batch operation cancelled by user. ${successCount} successful, ${errorCount} failed, ${remainingCount} skipped.`,
          {
            id: toastId,
          }
        );
      } else if (successCount > 0 && errorCount === 0) {
        toast.success(
          `✅ Successfully topped up all ${successCount} stakes! (100% complete)`,
          {
            id: toastId,
          }
        );
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(
          `⚠️ Completed with ${successCount} successes and ${errorCount} failures (100% complete)`,
          { id: toastId }
        );
      } else {
        toast.error("❌ All stake operations failed (100% complete)", {
          id: toastId,
        });
      }

      // Trigger success callback if at least one stake succeeded
      if (successCount > 0) {
        onSuccess?.();
      }
    } catch (error) {
      console.error("Top up selected stakes failed:", error);
      let message = "Failed to top up stakes";

      if (error instanceof Error) {
        if (
          error.message.includes("cancelled") ||
          error.message.includes("rejected")
        ) {
          message = "Operation cancelled by user";
        } else {
          message = error.message;
        }
      }

      toast.error(message, { id: toastId });
    } finally {
      setIsLoading(false);
      setCurrentProgress({ current: 0, total: 0 });
    }
  };

  const handleButtonClick = async () => {
    if (!effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected");
      return;
    }

    // Prepare stakes with balances for the modal
    const toastId = toast.loading("Checking available tokens...");

    try {
      // Filter stakes that have valid staking addresses
      const validStakes = stakes.filter(
        (stake) =>
          stake.stakingAddress &&
          stake.stakingAddress !== "" &&
          stake.stakingAddress !== "0x0000000000000000000000000000000000000000"
      );

      const stakesWithBalances: Array<{
        tokenAddress: string;
        stakingAddress: string;
        stakingPoolAddress: string;
        symbol: string;
        balance: bigint;
      }> = [];

      // Use the balance information that's already available in stakes from the page
      for (const stake of validStakes) {
        // Get current balance from the stake's receivedBalance + streamedAmount
        const currentBalance = stake.baseAmount + stake.streamedAmount;
        const balanceInWei = BigInt(Math.floor(currentBalance * 1e18));

        if (balanceInWei > 0n) {
          stakesWithBalances.push({
            tokenAddress: stake.tokenAddress,
            stakingAddress: stake.stakingAddress,
            stakingPoolAddress: stake.stakingPoolAddress,
            symbol: stake.membership.pool.token.symbol,
            balance: balanceInWei,
          });
        }
      }

      toast.dismiss(toastId);

      if (stakesWithBalances.length === 0) {
        toast.error("No tokens available to stake");
        return;
      }

      // Store the prepared data and open modal
      setPreparedStakes(stakesWithBalances);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error preparing stakes:", error);
      toast.error("Failed to load token information", { id: toastId });
    }
  };

  // Don't show button if no valid stakes
  const validStakesCount = stakes.filter(
    (stake) =>
      stake.stakingAddress &&
      stake.stakingAddress !== "" &&
      stake.stakingAddress !== "0x0000000000000000000000000000000000000000"
  ).length;

  if (validStakesCount === 0) {
    return null;
  }

  const progressPercentage =
    currentProgress.total > 0
      ? Math.round((currentProgress.current / currentProgress.total) * 100)
      : 0;

  return (
    <>
      <button
        onClick={handleButtonClick}
        disabled={disabled || isLoading}
        className={className}
      >
        {isLoading ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            {currentProgress.total > 0 ? (
              <>
                Processing ({currentProgress.current}/{currentProgress.total}) -{" "}
                {progressPercentage}%
              </>
            ) : (
              "Processing..."
            )}
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Top-up All Stakes ({validStakesCount})
          </>
        )}
      </button>

      <TopUpStakeSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stakesWithBalances={preparedStakes}
        onProceed={handleTopUpSelected}
      />
    </>
  );
}
