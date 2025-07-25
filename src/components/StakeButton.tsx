"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
// import { base } from "viem/chains"; // Removed as it's no longer used
import { StakeModal } from "./StakeModal";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "@/src/lib/viemClient"; // Import the centralized client
import { toast } from "sonner"; // Added for Mini App placeholder
import sdk from "@farcaster/miniapp-sdk"; // Added Farcaster SDK
import { usePostHog } from "posthog-js/react"; // Added PostHog hook
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "@/src/lib/analytics"; // Added analytics constants
import { formatUnits } from "viem"; // Added for amount formatting
import { useWallets } from "@privy-io/react-auth";
import { appendReferralTag, submitDivviReferral } from "@/src/lib/divvi";

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
  tokenBalance?: bigint;
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
  tokenBalance = BigInt(0),
}: StakeButtonProps) {
  const { address: wagmiAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { wallets } = useWallets();
  const {
    address: fcAddress,
    isConnected: fcIsConnected,
  } = useAppFrameLogic();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const postHog = usePostHog();

  // Use passed balance instead of making additional API calls
  const balance = tokenBalance;

  // Use explicit mini-app check with fallback to passed prop
  const isEffectivelyMiniApp = isMiniApp || false;
  
  const currentAddress = isEffectivelyMiniApp 
    ? (farcasterAddress ?? fcAddress)
    : wagmiAddress;
  
  const walletIsConnected = isEffectivelyMiniApp 
    ? (farcasterIsConnected ?? fcIsConnected)
    : !!wagmiAddress;

  const checkAllowance = async () => {
    if (!currentAddress || !walletIsConnected) return 0n;
    try {
      const allowance = await publicClient.readContract({
        address: toHex(tokenAddress),
        abi: erc20ABI,
        functionName: "allowance",
        args: [toHex(currentAddress!), toHex(stakingAddress)],
      });
      return allowance as bigint;
    } catch (error) {
      console.error("Error checking allowance:", error);
      return 0n;
    }
  };

  const handleStake = async (amount: bigint) => {
    if (!currentAddress || !walletIsConnected) {
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

      if (isEffectivelyMiniApp) {
        const ethProvider = await sdk.wallet.getEthereumProvider();
        if (!ethProvider)
          throw new Error("Farcaster Ethereum provider not available.");

        const currentAllowance = await checkAllowance();
        if ((currentAllowance as bigint) < amount) {
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
          const approveDataWithReferral = await appendReferralTag(
            toHex(approveData),
            toHex(currentAddress!)
          );
          approveTxHash = await ethProvider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(tokenAddress),
                from: toHex(currentAddress!),
                data: approveDataWithReferral,
                chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
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
          
          // Submit referral to Divvi
          await submitDivviReferral(approveTxHash, 8453); // Base L2 chain ID
          
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
          toHex(currentAddress!),
          amount,
        ]);
        const stakeDataWithReferral = await appendReferralTag(
          toHex(stakeData),
          toHex(currentAddress!)
        );
        stakeTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(stakingAddress),
              from: toHex(currentAddress!),
              data: stakeDataWithReferral,
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
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
        
        // Submit referral to Divvi
        await submitDivviReferral(stakeTxHash, 8453); // Base L2 chain ID
        
        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(currentAddress!)],
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
            const connectDataWithReferral = await appendReferralTag(
              toHex(connectData),
              toHex(currentAddress!)
            );
            connectTxHash = await ethProvider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  to: toHex(GDA_FORWARDER),
                  from: toHex(currentAddress!),
                  data: connectDataWithReferral,
                  chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
                },
              ],
            });
            if (!connectTxHash)
              throw new Error("Pool connection transaction hash not received.");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });
            
            // Submit referral to Divvi
            await submitDivviReferral(connectTxHash, 8453); // Base L2 chain ID
            
            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      } else {
        // Desktop/Mobile Path - use wagmi/privy for transaction
        if (!currentAddress) {
          throw new Error("Wallet not connected.");
        }

        // Get provider from Privy wallets or wagmi
        let provider: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (walletClient) {
          // If wagmi wallet client is available, use it
          provider = walletClient;
        } else {
          // Fallback to Privy wallet
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

        const currentAllowance = await checkAllowance();
        if ((currentAllowance as bigint) < amount) {
          toast.info(
            "Requesting unlimited approval for future transactions...",
            { id: toastId }
          );
          
          if (walletClient) {
            // Use wagmi wallet client for approval
            const { encodeFunctionData } = await import("viem");
            const abi = [{
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              name: "approve",
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
              type: "function",
            }] as const;
            
            const approveData = encodeFunctionData({
              abi,
              functionName: "approve",
              args: [toHex(stakingAddress), MAX_UINT256],
            });
            
            const approveDataWithReferral = await appendReferralTag(
              approveData,
              toHex(currentAddress!)
            );
            
            approveTxHash = await walletClient.sendTransaction({
              to: toHex(tokenAddress),
              data: approveDataWithReferral,
              account: toHex(currentAddress!),
              chain: undefined,
            });
          } else {
            // Use Privy provider
            const approveIface = new Interface([
              "function approve(address spender, uint256 amount) external returns (bool)",
            ]);
            const approveData = approveIface.encodeFunctionData("approve", [
              toHex(stakingAddress),
              MAX_UINT256,
            ]);
            const approveDataWithReferral = await appendReferralTag(
              toHex(approveData),
              toHex(currentAddress!)
            );
            approveTxHash = await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  to: toHex(tokenAddress),
                  from: toHex(currentAddress!),
                  data: approveDataWithReferral,
                  chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
                },
              ],
            });
          }
          
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
          
          // Submit referral to Divvi
          await submitDivviReferral(approveTxHash, 8453); // Base L2 chain ID
          
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
        
        if (walletClient) {
          // Use wagmi wallet client for staking
          const { encodeFunctionData } = await import("viem");
          const abi = [{
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "stake",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          }] as const;
          
          const stakeData = encodeFunctionData({
            abi,
            functionName: "stake",
            args: [toHex(currentAddress!), amount],
          });
          
          const stakeDataWithReferral = await appendReferralTag(
            stakeData,
            toHex(currentAddress!)
          );
          
          stakeTxHash = await walletClient.sendTransaction({
            to: toHex(stakingAddress),
            data: stakeDataWithReferral,
            account: toHex(currentAddress!),
            chain: undefined,
          });
        } else {
          // Use Privy provider
          const stakeIface = new Interface([
            "function stake(address to, uint256 amount) external",
          ]);
          const stakeData = stakeIface.encodeFunctionData("stake", [
            toHex(currentAddress!),
            amount,
          ]);
          const stakeDataWithReferral = await appendReferralTag(
            toHex(stakeData),
            toHex(currentAddress!)
          );
          stakeTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(stakingAddress),
                from: toHex(currentAddress!),
                data: stakeDataWithReferral,
                chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
              },
            ],
          });
        }
        
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
        
        // Submit referral to Divvi
        await submitDivviReferral(stakeTxHash, 8453); // Base L2 chain ID
        
        toast.success("Staking successful!", { id: toastId });

        if (
          stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000"
        ) {
          const connected = await publicClient.readContract({
            address: toHex(GDA_FORWARDER),
            abi: gdaABI,
            functionName: "isMemberConnected",
            args: [toHex(stakingPoolAddress), toHex(currentAddress!)],
          });
          if (!connected) {
            toast.loading("Connecting to reward pool...", { id: toastId });
            
            if (walletClient) {
              // Use wagmi wallet client for pool connection
              const { encodeFunctionData } = await import("viem");
              const abi = [{
                inputs: [
                  { name: "pool", type: "address" },
                  { name: "userData", type: "bytes" },
                ],
                name: "connectPool",
                outputs: [{ name: "", type: "bool" }],
                stateMutability: "nonpayable",
                type: "function",
              }] as const;
              
              const connectData = encodeFunctionData({
                abi,
                functionName: "connectPool",
                args: [toHex(stakingPoolAddress), "0x"],
              });
              
              const connectDataWithReferral = await appendReferralTag(
                connectData,
                toHex(currentAddress!)
              );
              
              connectTxHash = await walletClient.sendTransaction({
                to: toHex(GDA_FORWARDER),
                data: connectDataWithReferral,
                account: toHex(currentAddress!),
                chain: undefined,
              });
            } else {
              // Use Privy provider
              const gdaIface = new Interface([
                "function connectPool(address pool, bytes calldata userData) external returns (bool)",
              ]);
              const connectData = gdaIface.encodeFunctionData("connectPool", [
                toHex(stakingPoolAddress),
                "0x",
              ]);
              const connectDataWithReferral = await appendReferralTag(
                toHex(connectData),
                toHex(currentAddress!)
              );
              connectTxHash = await provider.request({
                method: "eth_sendTransaction",
                params: [
                  {
                    to: toHex(GDA_FORWARDER),
                    from: toHex(currentAddress!),
                    data: connectDataWithReferral,
                    chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
                  },
                ],
              });
            }
            
            if (!connectTxHash)
              throw new Error("Pool connection transaction hash not received.");
            await publicClient.waitForTransactionReceipt({
              hash: connectTxHash,
            });
            
            // Submit referral to Divvi
            await submitDivviReferral(connectTxHash, 8453); // Base L2 chain ID
            
            toast.success("Connected to reward pool!", { id: toastId });
            onPoolConnect?.();
          }
        }
      }
      // Common success path if all transactions succeeded
      onSuccess?.();

      // PostHog event tracking
      postHog.capture(POSTHOG_EVENTS.STAKE_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOKEN_ADDRESS]: tokenAddress,
        [ANALYTICS_PROPERTIES.STAKING_ADDRESS]: stakingAddress,
        [ANALYTICS_PROPERTIES.STAKING_POOL_ADDRESS]: stakingPoolAddress,
        [ANALYTICS_PROPERTIES.TOKEN_SYMBOL]: symbol,
        [ANALYTICS_PROPERTIES.AMOUNT_WEI]: amount.toString(),
        [ANALYTICS_PROPERTIES.AMOUNT_FORMATTED]: formatUnits(amount, 18),
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: currentAddress,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isEffectivelyMiniApp || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: stakeTxHash,
        [ANALYTICS_PROPERTIES.HAS_POOL_CONNECTION]:
          !!stakingPoolAddress &&
          stakingPoolAddress !== "0x0000000000000000000000000000000000000000",
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isEffectivelyMiniApp ? "farcaster" : "privy",
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

  const handleModalOpen = () => {
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
        isMiniApp={isEffectivelyMiniApp}
      />
    </>
  );
}
