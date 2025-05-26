"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { Modal } from "./Modal";
import { Zap } from "lucide-react";
import { publicClient } from "@/src/lib/viemClient";
import { sdk } from "@farcaster/frame-sdk"; // Added Farcaster SDK

const WETH = "0x4200000000000000000000000000000000000006";
const toHex = (address: string) => address as `0x${string}`;

interface ZapStakeButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  symbol: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
}

export function ZapStakeButton({
  tokenAddress,
  stakingAddress,
  symbol,
  className,
  disabled,
  onSuccess,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
}: ZapStakeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [amountIn, setAmountIn] = useState("0.001"); // Default 0.001 ETH
  const [ethBalance, setEthBalance] = useState<bigint>(0n);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { wallets } = useWallets();
  const { address: wagmiAddress } = useAccount();

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!wagmiAddress;
  const effectiveAddress = isMiniApp ? farcasterAddress : wagmiAddress;

  // Fetch ETH balance
  useEffect(() => {
    const fetchBalances = async () => {
      if (!effectiveAddress || !effectiveIsConnected) {
        setEthBalance(0n);
        return;
      }

      try {
        const eth = await publicClient.getBalance({
          address: toHex(effectiveAddress),
        });
        setEthBalance(eth);
      } catch (error) {
        console.error("Error fetching ETH balance:", error);
        setEthBalance(0n);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [effectiveAddress, effectiveIsConnected]);

  // Validate amount and check if transaction would be possible
  const { isValid, validationError } = useMemo(() => {
    if (!effectiveIsConnected) {
      return { isValid: false, validationError: "Wallet not connected" };
    }
    if (!effectiveAddress) {
      // Should not happen if effectiveIsConnected is true, but as a safeguard
      return { isValid: false, validationError: "Wallet address not found" };
    }

    const amount = parseFloat(amountIn);
    if (isNaN(amount) || amount <= 0) {
      return { isValid: false, validationError: "Invalid amount" };
    }

    try {
      const amountInWei = parseEther(amountIn);
      const estimatedGasCostForValidation = 300000n * parseEther("0.000000001"); // Basic gas estimate for UI validation
      const totalCostForValidation =
        amountInWei + estimatedGasCostForValidation;

      if (totalCostForValidation > ethBalance) {
        const maxAmount = Math.max(
          0,
          Number(
            formatEther(
              ethBalance > estimatedGasCostForValidation
                ? ethBalance - estimatedGasCostForValidation
                : 0n
            )
          )
        );
        return {
          isValid: false,
          validationError: `Not enough ETH. You can zap a maximum of ${maxAmount.toFixed(
            4
          )} ETH (after estimated gas cost).`,
        };
      }

      return { isValid: true, validationError: "" };
    } catch {
      return { isValid: false, validationError: "Invalid amount" };
    }
  }, [amountIn, ethBalance, effectiveIsConnected, effectiveAddress]);

  useEffect(() => {
    setErrorMessage(validationError);
  }, [validationError]);

  const handleZapStake = async () => {
    if (!isValid || !effectiveAddress || !effectiveIsConnected) {
      toast.error(validationError || "Wallet not connected or address missing");
      return;
    }
    setIsLoading(true);
    const toastId = toast.loading("Processing Zap & Stake...");

    try {
      const amountInWei = parseEther(amountIn);

      // 1. Get quote (common for both paths)
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
        const ethProvider = sdk.wallet.ethProvider;
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
        txHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(zapContractAddress),
              from: toHex(effectiveAddress!),
              data: zapData,
              value: `0x${amountInWei.toString(16)}`,
            },
          ],
        });
      } else {
        if (!wagmiAddress) throw new Error("Wagmi wallet not connected.");
        const wallet = wallets?.find((w) => w.address === wagmiAddress);
        if (!wallet) throw new Error("Wagmi Wallet not found");
        const provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
        let estimatedGas = 1200000n;
        try {
          estimatedGas = await publicClient.estimateGas({
            account: toHex(wagmiAddress!),
            to: toHex(zapContractAddress),
            value: amountInWei,
            data: zapData,
          });
        } catch (e) {
          console.error("Gas estimation failed (Wagmi):", e);
        }
        const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.2));
        const currentEthBalance = await publicClient.getBalance({
          address: toHex(wagmiAddress!),
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
        txHash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: toHex(zapContractAddress),
              from: toHex(wagmiAddress!),
              data: zapData,
              value: `0x${amountInWei.toString(16)}`,
              gas: `0x${gasLimit.toString(16)}`,
            },
          ],
        });
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

      toast.success("Zap & Stake successful!", { id: toastId });
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
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <div className="text-gray-400">
            Balance: {Number(formatEther(ethBalance)).toFixed(4)} ETH
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              min="0"
              step="0.001"
              placeholder="0.001"
              className={`input input-bordered w-full pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                !isValid && amountIn ? "input-error" : ""
              }`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
              ETH
            </div>
          </div>
          {errorMessage && (
            <div className="text-sm text-error">{errorMessage}</div>
          )}
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
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <Modal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
        >
          <div className="p-4 space-y-3">
            <h3 className="text-lg font-bold">Buy & Stake Successful! 🎉</h3>
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
            <a
              href={`https://explorer.superfluid.finance/base-mainnet/accounts/${effectiveAddress}?tab=pools`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent w-full"
            >
              Manage Stakes
            </a>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="btn btn-ghost w-full"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
