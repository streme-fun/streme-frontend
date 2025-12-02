"use client";

import { useState, useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { parseEther, formatEther } from "viem";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { Modal } from "./Modal";
import { Zap } from "lucide-react";
import { publicClient } from "@/src/lib/viemClient";
import sdk from "@farcaster/miniapp-sdk";
import { MyTokensModal } from "./MyTokensModal";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useSafeWallets } from "../hooks/useSafeWallet";
import { appendReferralTag, submitDivviReferral } from "@/src/lib/divvi";
import Link from "next/link";
import { ensureTxHash } from "@/src/lib/ensureTxHash";
import { ZAP_CONTRACT_ADDRESS } from "@/src/lib/contracts";

const WETH = "0x4200000000000000000000000000000000000006";
const ETHX = "0x46fd5cfb4c12d87acd3a13e92baa53240c661d93";
const toHex = (address: string) => address as `0x${string}`;

interface ZapStakeButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  symbol: string;
  pair?: string;
  lpType?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
  amount?: string;
}

export function ZapStakeButton({
  tokenAddress,
  stakingAddress,
  symbol,
  pair,
  lpType,
  className,
  disabled,
  onSuccess,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
  amount: externalAmount,
}: ZapStakeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showMyTokensModal, setShowMyTokensModal] = useState(false);

  const { address: wagmiAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { wallets } = useSafeWallets();
  const { address: fcAddress, isConnected: fcIsConnected } = useAppFrameLogic();

  // Use external amount if provided, otherwise default to "0.001"
  const amountIn = externalAmount || "0.001";

  const normalizedPair = pair?.toUpperCase() ?? "WETH";
  const isEthxPair = normalizedPair === "ETHX";
  const pairedTokenAddress = isEthxPair ? ETHX : WETH;
  const zapMethod: "zap" | "zapETHx" = isEthxPair ? "zapETHx" : "zap";

  // Use explicit mini-app check with fallback to passed prop
  const isEffectivelyMiniApp = isMiniApp || false;

  const currentAddress = isEffectivelyMiniApp
    ? farcasterAddress ?? fcAddress
    : wagmiAddress;

  const walletIsConnected = isEffectivelyMiniApp
    ? farcasterIsConnected ?? fcIsConnected
    : !!wagmiAddress;

  // Validate amount and check if transaction would be possible
  const { isValid } = useMemo(() => {
    if (!walletIsConnected) {
      return { isValid: false };
    }
    if (!currentAddress) {
      return { isValid: false };
    }

    const amount = parseFloat(amountIn);
    if (isNaN(amount) || amount <= 0) {
      return { isValid: false };
    }

    // For validation purposes, we'll assume it's valid since we don't have balance here
    // The actual validation will happen in the transaction
    return { isValid: true };
  }, [amountIn, walletIsConnected, currentAddress]);

  const handleZapStake = async () => {
    if (!isValid || !currentAddress || !walletIsConnected) {
      toast.error("Wallet not connected or address missing");
      return;
    }
    setIsLoading(true);
    const toastId = toast.loading("Processing Buy & Stake...");

    try {
      const amountInWei = parseEther(amountIn);

      // 1. Get quote (common for both paths)
      let quoterAddress = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
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
      if (lpType === "aero") {
        quoterAddress = "0x3d4C22254F86f64B7eC90ab8F7aeC1FBFD271c6C";
        quoterAbi[0].inputs[0].components[3] = {
          name: "tickSpacing", type: "int24"
        };
      }
      let args;
      if (lpType === "aero") {
        args = [
          {
            tokenIn: toHex(pairedTokenAddress),
            tokenOut: toHex(tokenAddress),
            amountIn: amountInWei,
            tickSpacing: 500,
            sqrtPriceLimitX96: 0n,
          },
        ];
      } else {
        args = [
          {
            tokenIn: toHex(pairedTokenAddress),
            tokenOut: toHex(tokenAddress),
            amountIn: amountInWei,
            fee: 10000,
            sqrtPriceLimitX96: 0n,
          },
        ];
      }
      const quoteResult = (await publicClient.readContract({
        address: quoterAddress as `0x${string}`,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: args,
      })) as [bigint, bigint, number, bigint];
      const amountOut = quoteResult[0];
      const amountOutMin = amountOut - amountOut / 200n; // 0.5% slippage

      const zapContractAddress = ZAP_CONTRACT_ADDRESS;
      const zapAbi = [
        "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256)",
        "function zapETHx(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256)",
      ];
      const zapIface = new Interface(zapAbi);
      const zapData = zapIface.encodeFunctionData(zapMethod, [
        toHex(tokenAddress),
        amountInWei,
        amountOutMin,
        toHex(stakingAddress),
      ]) as `0x${string}`;

      let txHash: `0x${string}`;

      if (isEffectivelyMiniApp) {
        const ethProvider = await sdk.wallet.getEthereumProvider();
        if (!ethProvider)
          throw new Error("Farcaster Ethereum provider not available.");
        const currentEthBalance = await publicClient.getBalance({
          address: toHex(currentAddress!),
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
        const zapDataWithReferral = await appendReferralTag(
          zapData,
          toHex(currentAddress!)
        );
        
        const rawTxHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(zapContractAddress),
              from: toHex(currentAddress!),
              data: zapDataWithReferral,
              value: `0x${amountInWei.toString(16)}`,
              chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
            },
          ],
        });
        txHash = ensureTxHash(
          rawTxHash,
          "Farcaster Ethereum provider"
        );
      } else {
        // Desktop/Mobile Path - use wagmi/privy for transaction
        if (!currentAddress) {
          throw new Error("Wallet not connected.");
        }

        // Check ETH balance first
        const currentEthBalance = await publicClient.getBalance({
          address: toHex(currentAddress!),
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

        // Get provider from wagmi wallet client or connector fallback
        if (walletClient) {
          // Use wagmi wallet client for zap & stake
          const { encodeFunctionData } = await import("viem");
          const abi = [
            {
              inputs: [
                { name: "tokenOut", type: "address" },
                { name: "amountIn", type: "uint256" },
                { name: "amountOutMin", type: "uint256" },
                { name: "stakingContract", type: "address" },
              ],
              name: "zap",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "payable",
              type: "function",
            },
            {
              inputs: [
                { name: "tokenOut", type: "address" },
                { name: "amountIn", type: "uint256" },
                { name: "amountOutMin", type: "uint256" },
                { name: "stakingContract", type: "address" },
              ],
              name: "zapETHx",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "payable",
              type: "function",
            },
          ] as const;
          
          const zapDataEncoded = encodeFunctionData({
            abi,
            functionName: zapMethod,
            args: [
              toHex(tokenAddress),
              amountInWei,
              amountOutMin,
              toHex(stakingAddress),
            ],
          });
          
          const zapDataWithReferral = await appendReferralTag(
            zapDataEncoded,
            toHex(currentAddress!)
          );
          
          txHash = await walletClient.sendTransaction({
            to: toHex(zapContractAddress),
            data: zapDataWithReferral,
            value: amountInWei,
            account: toHex(currentAddress!),
            chain: undefined,
          });
        } else {
          // Fallback to connector-provided provider
          const wallet = wallets.find((w) => w.address === wagmiAddress);
          if (!wallet) {
            throw new Error("Wallet not found");
          }
          const provider = await wallet.getEthereumProvider();
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }],
          });

          const zapDataWithReferral = await appendReferralTag(
            zapData,
            toHex(currentAddress!)
          );
          
          const rawTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                to: toHex(zapContractAddress),
                from: toHex(currentAddress!),
                data: zapDataWithReferral,
                value: `0x${amountInWei.toString(16)}`,
                chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
              },
            ],
          });
          txHash = ensureTxHash(
            rawTxHash,
            "Wallet connector provider"
          );
        }
      }

      if (!txHash) {
        // Explicitly check if txHash is missing (e.g. if user cancelled and provider returned nothing)
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
      
      // Submit referral to Divvi
      await submitDivviReferral(txHash, 8453); // Base L2 chain ID

      // Enhanced success message with amount details
      const ethAmount = parseFloat(amountIn).toFixed(4);
      toast.success(
        `⚡ Buy & Stake Complete! Purchased and staked ${symbol} with ${ethAmount} ETH`,
        {
          id: toastId,
          duration: 5000,
        }
      );
      setShowSuccessModal(true);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("ZapStake caught error:", error); // More detailed logging
      let message = "Zap & Stake failed. Please try again.";

      // Attempt to stringify the error for more details if it's an object
      let errorDetails = "";
      if (typeof error === "object" && error !== null) {
        errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error("ZapStake error details (stringified):", errorDetails);

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
          message = "Transaction rejected by user."; // Catching stringified error content
        }
      }
      toast.error(message, { id: toastId });
      // Ensure success modal is not shown
      setShowSuccessModal(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleZapStake}
        disabled={disabled || isLoading || !isValid}
        className={className}
      >
        {isLoading ? (
          "Processing..."
        ) : (
          <span className="flex items-center gap-1">
            <Zap size={16} />
            Buy & Stake
          </span>
        )}
      </button>

      {/* Success Modal */}
      {showSuccessModal && (
        <Modal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
        >
          <div className="p-4 space-y-3">
            <h3 className="text-lg font-bold">⚡ Buy & Stake Complete! 🎉</h3>
            <div className="text-center mb-3">
              <p className="text-sm text-gray-600">
                Purchased and staked {symbol} with{" "}
                {parseFloat(amountIn).toFixed(4)} ETH
              </p>
            </div>
            <div className="relative h-24 w-full overflow-hidden rounded-lg">
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 100"
                preserveAspectRatio="xMidYMid meet"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 50 Q100 50 200 50 T400 50"
                  stroke="hsl(220 13% 91%)"
                  strokeWidth="2"
                />
                <g
                  className="reward-particle"
                  style={{ offsetPath: "path('M0 50 Q100 50 200 50 T400 50')" }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.2s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.4s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.6s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
                <g
                  className="reward-particle"
                  style={{
                    offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    animationDelay: "-0.8s",
                  }}
                >
                  <circle r="4" fill="currentColor" className="text-primary" />
                </g>
              </svg>
              <style jsx>{`
                .reward-particle {
                  animation: flow 2s linear infinite;
                }
                @keyframes flow {
                  from {
                    offset-distance: 0%;
                  }
                  to {
                    offset-distance: 100%;
                  }
                }
              `}</style>
            </div>
            <p className="text-center text-sm pb-4">
              Successfully staked {symbol}. Token rewards are now being streamed
              directly to your wallet.
            </p>
            {isEffectivelyMiniApp ? (
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setShowMyTokensModal(true);
                }}
                className="btn btn-accent w-full"
              >
                Manage Stakes
              </button>
            ) : (
              <Link href="/tokens" className="btn btn-accent w-full">
                Manage Stakes
              </Link>
            )}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="btn btn-ghost w-full"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* MyTokensModal for mini app */}
      {showMyTokensModal && (
        <MyTokensModal
          isOpen={showMyTokensModal}
          onClose={() => setShowMyTokensModal(false)}
        />
      )}
    </>
  );
}
