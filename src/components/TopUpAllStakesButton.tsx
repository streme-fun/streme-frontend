"use client";

import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient";
import { toast } from "sonner";
import { sdk } from "@farcaster/frame-sdk";
import { TopUpStakeSelectionModal } from "./TopUpStakeSelectionModal";
import { usePostHog } from "posthog-js/react";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics";

// Contract addresses
const STAKING_MACRO_V2 = "0x5c4b8561363E80EE458D3F0f4F14eC671e1F54Af";
const MACRO_FORWARDER = "0xFD0268E33111565dE546af2675351A4b1587F89F";

// ABIs for the new contracts
const stakingMacroABI = [
  {
    inputs: [{ name: "tokens", type: "address[]" }],
    name: "getParams",
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const toHex = (address: string) => address as `0x${string}`;

interface TopUpAllStakesButtonProps {
  stakes: Array<{
    tokenAddress: string;
    stakingAddress: string;
    stakingPoolAddress: string;
    baseAmount: number;
    membership: {
      pool: {
        token: {
          symbol: string;
        };
      };
    };
  }>;
  ownedSuperTokens?: Array<{
    tokenAddress: string;
    symbol: string;
    balance: number;
    stakingAddress?: string;
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
  ownedSuperTokens = [],
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
  const postHog = usePostHog();

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!wagmiAddress;
  const effectiveAddress = isMiniApp ? farcasterAddress : wagmiAddress;

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
    setCurrentProgress({ current: 0, total: 1 }); // Just 1 step: execute macro
    const toastId = toast.loading("Preparing batch operation...");

    try {
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

      // Execute batch operation using MacroForwarder
      // The macro executes "in first person" and handles everything:
      // - Checking user balances
      // - Transferring tokens directly from user
      // - Staking tokens
      // - Connecting to reward pools
      setCurrentProgress({ current: 1, total: 1 });
      toast.loading("Executing batch staking operation...", { id: toastId });

      const tokenAddresses = selectedStakes.map((stake) => stake.tokenAddress);
      const uniqueTokens = [...new Set(tokenAddresses)];

      // Get encoded parameters from StakingMacroV2
      const encodedAddresses = await publicClient.readContract({
        address: toHex(STAKING_MACRO_V2),
        abi: stakingMacroABI,
        functionName: "getParams",
        args: [uniqueTokens.map((addr) => toHex(addr))],
      });

      // Execute the macro via MacroForwarder
      // This handles everything in batch "in first person" by the user
      const macroIface = new Interface([
        "function runMacro(address macro, bytes calldata params) external",
      ]);
      const macroData = macroIface.encodeFunctionData("runMacro", [
        toHex(STAKING_MACRO_V2),
        encodedAddresses,
      ]);

      const macroTxParams: Record<string, unknown> = {
        to: toHex(MACRO_FORWARDER),
        from: toHex(userAddress),
        data: toHex(macroData),
      };

      // Add gas estimation for non-miniApp
      if (!isMiniApp) {
        try {
          const estimatedGas = await publicClient.estimateGas({
            account: userAddress as `0x${string}`,
            to: toHex(MACRO_FORWARDER),
            data: macroData as `0x${string}`,
          });
          const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.5));
          macroTxParams.gas = `0x${gasLimit.toString(16)}`;
        } catch {
          console.warn("Gas estimation failed, proceeding without limit");
        }
      }

      const macroTxHash = await provider.request({
        method: "eth_sendTransaction",
        params: [macroTxParams],
      });

      if (!macroTxHash) {
        throw new Error("Batch staking operation was cancelled");
      }

      const macroReceipt = await publicClient.waitForTransactionReceipt({
        hash: macroTxHash as `0x${string}`,
      });

      if (macroReceipt.status !== "success") {
        throw new Error("Batch staking operation failed");
      }

      // Success!
      toast.success(
        `Successfully completed batch staking for ${selectedStakes.length} ${
          selectedStakes.length === 1 ? "token" : "tokens"
        }!`,
        { id: toastId }
      );

      // Auto-dismiss the success toast after 4 seconds
      setTimeout(() => {
        toast.dismiss(toastId);
      }, 4000);

      onSuccess?.();

      // PostHog event tracking
      postHog.capture(POSTHOG_EVENTS.TOP_UP_ALL_STAKES_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOTAL_TOKENS_COUNT]: selectedStakes.length,
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: effectiveAddress,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: macroTxHash,
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isMiniApp ? "farcaster" : "wagmi",
        token_addresses: selectedStakes
          .map((stake) => stake.tokenAddress)
          .join(","),
        token_symbols: selectedStakes.map((stake) => stake.symbol).join(","),
        total_balance_wei: selectedStakes
          .reduce((sum, stake) => sum + stake.balance, 0n)
          .toString(),
      });
    } catch (error) {
      console.error("Batch staking operation failed:", error);
      let message = "Failed to complete batch staking operation";

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

      // Process already staked tokens
      for (const stake of validStakes) {
        // Get current balance from the stake's receivedBalance + streamedAmount
        const currentBalance = stake.baseAmount;
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

      // Process owned SuperTokens (not yet staked)
      for (const superToken of ownedSuperTokens) {
        // Only include tokens that have staking addresses and positive balances
        if (
          superToken.stakingAddress &&
          superToken.stakingAddress !== "" &&
          superToken.stakingAddress !==
            "0x0000000000000000000000000000000000000000" &&
          superToken.balance > 0
        ) {
          const balanceInWei = BigInt(Math.floor(superToken.balance * 1e18));

          // Avoid duplicates - check if this token is already in stakes
          const isDuplicate = stakesWithBalances.some(
            (stake) =>
              stake.tokenAddress.toLowerCase() ===
              superToken.tokenAddress.toLowerCase()
          );

          if (!isDuplicate) {
            stakesWithBalances.push({
              tokenAddress: superToken.tokenAddress,
              stakingAddress: superToken.stakingAddress,
              stakingPoolAddress: "", // SuperTokens don't have existing pool addresses
              symbol: superToken.symbol,
              balance: balanceInWei,
            });
          }
        }
      }

      if (stakesWithBalances.length === 0) {
        toast.error("No tokens available to stake", { id: toastId });
        return;
      }

      // Dismiss the loading toast before proceeding
      toast.dismiss(toastId);

      // Store the prepared data and open modal
      setPreparedStakes(stakesWithBalances);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error preparing stakes:", error);
      toast.error("Failed to load token information", { id: toastId });
    } finally {
      // Ensure toast is always dismissed, even if there are unexpected errors
      setTimeout(() => {
        toast.dismiss(toastId);
      }, 100);
    }
  };

  // Calculate total available tokens (both staked and unstaked)
  // This logic must match exactly what handleButtonClick filters
  const validStakesCount = stakes.filter(
    (stake) =>
      stake.stakingAddress &&
      stake.stakingAddress !== "" &&
      stake.stakingAddress !== "0x0000000000000000000000000000000000000000" &&
      stake.baseAmount > 0 // Must have positive balance to be stakeable
  ).length;

  const validSuperTokensCount = ownedSuperTokens.filter(
    (token) =>
      token.stakingAddress &&
      token.stakingAddress !== "" &&
      token.stakingAddress !== "0x0000000000000000000000000000000000000000" &&
      token.balance > 0 &&
      // Avoid counting duplicates with stakes
      !stakes.some(
        (stake) =>
          stake.tokenAddress.toLowerCase() === token.tokenAddress.toLowerCase()
      )
  ).length;

  const totalAvailableTokens = validStakesCount + validSuperTokensCount;

  if (totalAvailableTokens === 0) {
    return null;
  }

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
            {currentProgress.total > 0 ? <>Processing</> : "Processing..."}
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
            Top up All Tokens ({totalAvailableTokens})
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
