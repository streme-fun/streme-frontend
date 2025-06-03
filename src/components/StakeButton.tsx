"use client";

import { useState, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";
import { usePrivy } from "@privy-io/react-auth";
// import { base } from "viem/chains"; // Removed as it's no longer used
import { StakeModal } from "./StakeModal";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient"; // Import the centralized client
import { toast } from "sonner"; // Added for Mini App placeholder
import { sdk } from "@farcaster/frame-sdk"; // Added Farcaster SDK
import { useWalletAddressChange } from "@/src/hooks/useWalletSync";
import { usePostHog } from "posthog-js/react"; // Added PostHog hook
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics"; // Added analytics constants
import { formatUnits } from "viem"; // Added for amount formatting

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

const toHex = (address: string) => address as `0x${string}`;

// Add constant for unlimited allowance
const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

interface StakeButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  disabled?: boolean;
  className?: string;
  symbol: string;
  totalStakers?: string;
  onSuccess?: () => void;
  onPoolConnect?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
}

export function StakeButton({
  tokenAddress,
  stakingAddress,
  stakingPoolAddress,
  disabled,
  className,
  symbol,
  totalStakers,
  onSuccess,
  onPoolConnect,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
}: StakeButtonProps) {
  const { wallets } = useWallets();
  const { user } = usePrivy();
  const { refreshTrigger, primaryAddress } = useWalletAddressChange();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false); // Added for loading state
  const postHog = usePostHog(); // Added PostHog instance

  const effectiveIsConnected =
    farcasterIsConnected ?? (isMiniApp ? false : !!user?.wallet?.address);
  const effectiveAddress = isMiniApp
    ? farcasterAddress
    : primaryAddress || user?.wallet?.address;

  // Separate fetchBalance function that can be called from anywhere
  const fetchBalance = async () => {
    if (!effectiveAddress || !effectiveIsConnected) {
      setBalance(0n);
      return;
    }

    try {
      const bal = await publicClient.readContract({
        address: toHex(tokenAddress),
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
        args: [toHex(effectiveAddress)],
      });
      setBalance(bal);
    } catch (error) {
      console.error("Error fetching token balance:", error);
      setBalance(0n);
    }
  };

  // Fetch token balance - using direct useEffect pattern like ZapStakeButton
  useEffect(() => {
    const fetchBalanceInternal = async () => {
      if (!effectiveAddress || !effectiveIsConnected) {
        setBalance(0n);
        return;
      }

      try {
        const bal = await publicClient.readContract({
          address: toHex(tokenAddress),
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
          args: [toHex(effectiveAddress)],
        });
        setBalance(bal);
      } catch (error) {
        console.error("Error fetching token balance:", error);
        setBalance(0n);
      }
    };

    fetchBalanceInternal();
    const interval = setInterval(fetchBalanceInternal, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [effectiveAddress, effectiveIsConnected, tokenAddress, refreshTrigger]);

  const checkAllowance = async () => {
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

  const handleStake = async (amount: bigint) => {
    if (!effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected or address missing");
      throw new Error("Wallet not connected or address missing");
    }

    // Pre-flight checks before attempting the transaction
    if (amount <= 0n) {
      toast.error("Invalid stake amount");
      throw new Error("Invalid stake amount");
    }

    if (balance < amount) {
      toast.error("Insufficient token balance for staking");
      throw new Error("Insufficient token balance for staking");
    }

    setIsLoading(true);
    const toastId = toast.loading("Preparing stake transaction...");

    try {
      let approveTxHash: `0x${string}` | undefined;
      let stakeTxHash: `0x${string}` | undefined;
      let connectTxHash: `0x${string}` | undefined;

      if (isMiniApp) {
        const ethProvider = sdk.wallet.ethProvider;
        if (!ethProvider)
          throw new Error("Farcaster Ethereum provider not available.");

        const currentAllowance = await checkAllowance();
        if (currentAllowance < amount) {
          toast.info(
            "Requesting unlimited approval for future transactions...",
            { id: toastId }
          );
          const approveIface = new Interface([
            "function approve(address spender, uint256 amount) external returns (bool)",
          ]);
          const approveData = approveIface.encodeFunctionData("approve", [
            toHex(stakingAddress),
            MAX_UINT256, // Use unlimited allowance instead of just the amount
          ]);
          approveTxHash = await ethProvider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(tokenAddress),
                from: toHex(effectiveAddress!),
                data: toHex(approveData),
              },
            ],
          });
          if (!approveTxHash)
            throw new Error(
              "Approval transaction hash not received. User might have cancelled."
            );
          toast.loading("Waiting for approval confirmation...", {
            id: toastId,
          });
          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveTxHash,
          });
          if (approveReceipt.status !== "success")
            throw new Error("Approval transaction failed");
          toast.success(
            "Approval successful! You won't need to approve again.",
            { id: toastId }
          );
        } else {
          toast.info("Sufficient allowance found, skipping approval...", {
            id: toastId,
          });
        }

        toast.loading("Requesting stake...", { id: toastId });
        const stakeIface = new Interface([
          "function stake(address to, uint256 amount) external",
        ]);
        const stakeData = stakeIface.encodeFunctionData("stake", [
          toHex(effectiveAddress!),
          amount,
        ]);
        stakeTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(stakingAddress),
              from: toHex(effectiveAddress!),
              data: toHex(stakeData),
            },
          ],
        });
        if (!stakeTxHash)
          throw new Error(
            "Stake transaction hash not received. User might have cancelled."
          );
        toast.loading("Waiting for stake confirmation...", { id: toastId });
        const stakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: stakeTxHash,
        });
        if (stakeReceipt.status !== "success")
          throw new Error("Stake transaction failed");
        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(effectiveAddress!)],
          });
          if (!connected) {
            toast.loading("Connecting to reward pool...", { id: toastId });
            const gdaIface = new Interface([
              "function connectPool(address pool, bytes calldata userData) external returns (bool)",
            ]);
            const connectData = gdaIface.encodeFunctionData("connectPool", [
              toHex(stakingPoolAddress),
              "0x",
            ]);
            connectTxHash = await ethProvider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  to: toHex(GDA_FORWARDER),
                  from: toHex(effectiveAddress!),
                  data: toHex(connectData),
                },
              ],
            });
            if (!connectTxHash)
              throw new Error("Pool connection transaction hash not received.");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });
            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      } else {
        // Privy Path (updated from Wagmi to match ConnectPoolButton pattern)
        console.log(
          "StakeButton: Privy transaction path - debugging wallet lookup:",
          {
            userWalletAddress: user?.wallet?.address,
            availableWallets: wallets?.map((w) => ({
              address: w.address,
              type: w.walletClientType,
            })),
            walletsLength: wallets?.length,
          }
        );

        if (!user?.wallet?.address)
          throw new Error("Privy wallet not connected.");

        // Wait for wallets to be ready
        if (!wallets || wallets.length === 0) {
          throw new Error("Wallets not ready. Please try again in a moment.");
        }

        let wallet = wallets.find((w) => w.address === user.wallet?.address);

        // Fallback: if exact match fails, try case-insensitive match
        if (!wallet) {
          wallet = wallets.find(
            (w) =>
              w.address?.toLowerCase() === user.wallet?.address?.toLowerCase()
          );
        }

        // Fallback: if still no match and there's only one wallet, use it
        if (!wallet && wallets.length === 1) {
          console.warn("StakeButton: Using fallback to first available wallet");
          wallet = wallets[0];
        }

        if (!wallet) {
          console.error("StakeButton: Wallet not found in available wallets:", {
            searchingFor: user.wallet.address,
            availableAddresses: wallets?.map((w) => w.address),
          });
          throw new Error("Wallet not found. Please reconnect.");
        }

        // Use the wallet's actual address, not user.wallet.address
        const walletAddress = wallet.address;
        if (!walletAddress) throw new Error("Wallet address not available");

        const provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        const currentAllowance = await checkAllowance();
        if (currentAllowance < amount) {
          toast.info(
            "Requesting unlimited approval for future transactions...",
            { id: toastId }
          );
          const approveIface = new Interface([
            "function approve(address spender, uint256 amount) external returns (bool)",
          ]);
          const approveData = approveIface.encodeFunctionData("approve", [
            toHex(stakingAddress),
            MAX_UINT256, // Use unlimited allowance instead of just the amount
          ]);
          const approveTxResult = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(tokenAddress),
                from: toHex(walletAddress),
                data: toHex(approveData),
              },
            ],
          });
          approveTxHash = approveTxResult as `0x${string}`;
          if (!approveTxHash)
            throw new Error(
              "Approval transaction hash not received (Privy). User might have cancelled."
            );
          toast.loading("Waiting for approval confirmation...", {
            id: toastId,
          });
          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveTxHash,
          });
          if (!approveReceipt.status || approveReceipt.status !== "success")
            throw new Error("Approval transaction failed (Privy)");
          toast.success(
            "Approval successful! You won't need to approve again.",
            { id: toastId }
          );
        } else {
          toast.info("Sufficient allowance found, skipping approval...", {
            id: toastId,
          });
        }

        toast.loading("Requesting stake...", { id: toastId });
        const stakeIface = new Interface([
          "function stake(address to, uint256 amount) external",
        ]);
        const stakeData = stakeIface.encodeFunctionData("stake", [
          toHex(walletAddress),
          amount,
        ]);

        // Try to estimate gas first with better error handling
        try {
          const estimatedGas = await publicClient.estimateGas({
            account: walletAddress as `0x${string}`,
            to: toHex(stakingAddress),
            data: stakeData as `0x${string}`,
          });
          const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.5));
          const gas = `0x${gasLimit.toString(16)}` as `0x${string}`;

          const stakeTxResult = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(stakingAddress),
                from: toHex(walletAddress),
                data: toHex(stakeData),
                gas: gas,
              },
            ],
          });
          stakeTxHash = stakeTxResult as `0x${string}`;
        } catch (gasError) {
          console.error("Gas estimation failed:", gasError);
          // Provide more specific error messages based on common causes
          let specificMessage = "Gas estimation failed";

          if (
            gasError &&
            typeof gasError === "object" &&
            "message" in gasError
          ) {
            const errorMessage = (gasError as { message: string }).message;
            if (errorMessage.includes("execution reverted")) {
              // Try to provide more specific guidance
              if (amount <= 0n) {
                specificMessage =
                  "Invalid stake amount - must be greater than 0";
              } else if (balance < amount) {
                specificMessage = "Insufficient token balance for staking";
              } else {
                // Check if the staking contract might have minimum requirements
                specificMessage =
                  "Staking contract rejected the transaction. This could be due to: minimum staking amount requirements, contract being paused, or insufficient gas. Please try a smaller amount or contact support.";
              }
            }
          }

          throw new Error(specificMessage);
        }

        if (!stakeTxHash)
          throw new Error(
            "Stake transaction hash not received (Privy). User might have cancelled."
          );
        toast.loading("Waiting for stake confirmation...", { id: toastId });
        const stakeReceipt = await publicClient.waitForTransactionReceipt({
          hash: stakeTxHash,
        });
        if (!stakeReceipt.status || stakeReceipt.status !== "success")
          throw new Error("Stake transaction failed (Privy)");
        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(walletAddress)],
          });
          if (!connected) {
            toast.loading("Connecting to reward pool...", { id: toastId });
            const gdaIface = new Interface([
              "function connectPool(address pool, bytes calldata userData) external returns (bool)",
            ]);
            const connectData = gdaIface.encodeFunctionData("connectPool", [
              toHex(stakingPoolAddress),
              "0x",
            ]);
            const connectTxResult = await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  to: toHex(GDA_FORWARDER),
                  from: toHex(walletAddress),
                  data: toHex(connectData),
                },
              ],
            });
            connectTxHash = connectTxResult as `0x${string}`;
            if (!connectTxHash)
              throw new Error("Pool conn tx hash not received (Privy).");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });
            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      }
      // Common success path if all transactions succeeded
      await fetchBalance();
      onSuccess?.();

      // PostHog event tracking
      postHog.capture(POSTHOG_EVENTS.STAKE_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOKEN_ADDRESS]: tokenAddress,
        [ANALYTICS_PROPERTIES.STAKING_ADDRESS]: stakingAddress,
        [ANALYTICS_PROPERTIES.STAKING_POOL_ADDRESS]: stakingPoolAddress,
        [ANALYTICS_PROPERTIES.TOKEN_SYMBOL]: symbol,
        [ANALYTICS_PROPERTIES.AMOUNT_WEI]: amount.toString(),
        [ANALYTICS_PROPERTIES.AMOUNT_FORMATTED]: formatUnits(amount, 18),
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: effectiveAddress,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: stakeTxHash,
        [ANALYTICS_PROPERTIES.HAS_POOL_CONNECTION]:
          !!stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000",
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isMiniApp ? "farcaster" : "privy",
      });
    } catch (error: unknown) {
      console.error("StakeButton caught error:", error);
      let message = "Stake operation failed.";
      let errorDetails = "";
      if (typeof error === "object" && error !== null) {
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error("StakeButton error details (stringified):", errorDetails);

      if (typeof error === "object" && error !== null) {
        if (
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ) {
          const errorMessage = (error as { message: string }).message;
          if (
            errorMessage.includes("User rejected") ||
            errorMessage.includes("cancelled") ||
            errorMessage.includes("hash not received")
          ) {
            message = "Transaction rejected or cancelled.";
          } else if (
            errorMessage.includes("Insufficient token balance") ||
            errorMessage.includes("Invalid stake amount") ||
            errorMessage.includes("Gas estimation failed") ||
            errorMessage.includes("Staking contract rejected")
          ) {
            // Use our custom error messages as-is
            message = errorMessage;
          } else {
            message = errorMessage.substring(0, 100);
          }
        } else if (
          "shortMessage" in error &&
          typeof (error as { shortMessage: unknown }).shortMessage === "string"
        ) {
          message = (error as { shortMessage: string }).shortMessage;
        } else if (
          errorDetails.includes("UserRejected") ||
          errorDetails.includes("User denied") ||
          errorDetails.includes("rejected by user")
        ) {
          message = "Transaction rejected by user.";
        } else if (errorDetails.includes("execution reverted")) {
          message =
            "Transaction failed. This could be due to insufficient balance, contract restrictions, or minimum staking requirements.";
        }
      }
      toast.error(message, { id: toastId });
      // Rethrow the error so that StakeModal's internal catch block can also handle it if needed for its UI
      // Or, ensure StakeModal's onStake is not trying to set its own success state if this promise rejects.
      // The current StakeModal updates its UI based on onStake promise resolution.
      // So, throwing here is correct to signal failure to StakeModal.
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalOpen = async () => {
    await fetchBalance();
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleModalOpen}
        disabled={disabled || isLoading} // Disable button when loading
        className={className}
      >
        {isLoading ? "Processing..." : "Stake"}
      </button>

      <StakeModal
        isOpen={isModalOpen}
        onClose={() => !isLoading && setIsModalOpen(false)} // Prevent closing modal while loading
        tokenAddress={tokenAddress}
        stakingAddress={stakingAddress}
        balance={balance}
        symbol={symbol}
        totalStakers={totalStakers}
        onStake={handleStake}
        onSuccess={onSuccess} // Pass onSuccess to modal if it needs to trigger something on close after success
        onRefreshBalance={fetchBalance} // Pass balance refresh function
        isMiniApp={isMiniApp}
      />
    </>
  );
}
