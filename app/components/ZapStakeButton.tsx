"use client";

import { useState, useEffect, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, http, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { toast } from "sonner";
import { Interface } from "@ethersproject/abi";
import { Modal } from "./Modal";
import { Zap } from "lucide-react";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const WETH = "0x4200000000000000000000000000000000000006";

interface ZapStakeButtonProps {
  tokenAddress: string;
  stakingAddress: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function ZapStakeButton({
  tokenAddress,
  stakingAddress,
  className,
  disabled,
  onSuccess,
}: ZapStakeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [amountIn, setAmountIn] = useState("0.001"); // Default 0.001 ETH
  const [ethBalance, setEthBalance] = useState<bigint>(0n);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { user } = usePrivy();
  const { wallets } = useWallets();

  // Fetch ETH and WETH balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!user?.wallet?.address) return;

      try {
        const eth = await publicClient.getBalance({
          address: user.wallet.address as `0x${string}`,
        });
        setEthBalance(eth);
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
    // Set up an interval to refresh the balances
    const interval = setInterval(fetchBalances, 10000);

    return () => clearInterval(interval);
  }, [user?.wallet?.address]);

  // Validate amount and check if transaction would be possible
  const { isValid, validationError } = useMemo(() => {
    if (!user?.wallet?.address) {
      return { isValid: false, validationError: "Wallet not connected" };
    }

    const amount = parseFloat(amountIn);
    if (isNaN(amount) || amount <= 0) {
      return { isValid: false, validationError: "Invalid amount" };
    }

    try {
      const amountInWei = parseEther(amountIn);
      // Add estimated gas cost (using conservative estimate)
      const estimatedGasCost = 300000n * parseEther("0.000000001"); // Assuming 1 gwei gas price for estimation
      const totalCost = amountInWei + estimatedGasCost;

      if (totalCost > ethBalance) {
        const maxAmount = Number(formatEther(ethBalance - estimatedGasCost));
        return {
          isValid: false,
          validationError: `Insufficient balance. Max: ${maxAmount.toFixed(
            4
          )} ETH`,
        };
      }

      return { isValid: true, validationError: "" };
    } catch {
      return { isValid: false, validationError: "Invalid amount" };
    }
  }, [amountIn, ethBalance, user?.wallet?.address]);

  useEffect(() => {
    setErrorMessage(validationError);
  }, [validationError]);

  const handleZapStake = async () => {
    if (!isValid || !user?.wallet?.address) {
      toast.error(validationError || "Wallet not connected");
      return;
    }

    setIsLoading(true);
    try {
      const walletAddress = user.wallet.address;
      const wallet = wallets?.find(
        (w: { address: string }) => w.address === walletAddress
      );

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const provider = await wallet.getEthereumProvider();

      // Add this section to switch network if needed
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x2105" }], // 0x2105 is hex for 8453 (Base)
      });

      // Convert amount to BigInt (wei)
      const amountInWei = parseEther(amountIn);

      // Check user's ETH balance
      const ethBalance = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      // Estimate gas for the transaction
      const zapAddress = "0xeA25b9CD2D9F8Ba6cff45Ed0f6e1eFa2fC79a57E";
      const zapAbi = [
        "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) external payable returns (uint256)",
      ];

      // Get gas price
      const gasPrice = await publicClient.getGasPrice();

      // Estimate gas (we'll try to estimate before the actual transaction)
      let estimatedGas;
      try {
        estimatedGas = await publicClient.estimateGas({
          account: walletAddress as `0x${string}`,
          to: zapAddress as `0x${string}`,
          value: amountInWei,
          data: "0x", // We'll just use empty data for estimation
        });
      } catch {
        // If estimation fails, use a safe upper limit
        estimatedGas = 300000n;
      }

      // Calculate total cost (gas * gas price + value to send)
      const totalCost = estimatedGas * gasPrice + amountInWei;

      // Check if user has enough balance
      if (ethBalance < totalCost) {
        const requiredEth = Number(formatEther(totalCost));
        const availableEth = Number(formatEther(ethBalance));
        throw new Error(
          `Insufficient funds. You need approximately ${requiredEth.toFixed(
            4
          )} ETH but have ${availableEth.toFixed(4)} ETH`
        );
      }

      // 1. Get quote from Uniswap Quoter
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

      // Call quoter contract to get expected output amount
      toast.info("Getting swap quote...");
      const quoteResult = (await publicClient.readContract({
        address: quoterAddress as `0x${string}`,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: WETH,
            tokenOut: tokenAddress as `0x${string}`,
            amountIn: amountInWei,
            fee: 10000, // 1% fee
            sqrtPriceLimitX96: 0n,
          },
        ],
      })) as [bigint, bigint, number, bigint];

      // Calculate minimum amount out with 0.5% slippage
      const amountOut = quoteResult[0];
      const amountOutMin = amountOut - amountOut / 200n;

      toast.info(
        `Expected to receive: ${amountOut.toString()} tokens (min: ${amountOutMin.toString()})`
      );

      // 2. Call the zap function
      const zapIface = new Interface(zapAbi);
      const zapData = zapIface.encodeFunctionData("zap", [
        tokenAddress,
        amountInWei,
        amountOutMin,
        stakingAddress,
      ]);

      toast.info("Initiating zap stake transaction...");

      // Use the previously estimated gas with safety margin
      const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.5));
      const gas = `0x${gasLimit.toString(16)}` as `0x${string}`;

      // Send the transaction
      const zapTx = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: zapAddress,
            from: walletAddress,
            data: zapData,
            value: `0x${amountInWei.toString(16)}`, // Convert to hex
            gas: gas,
          },
        ],
      });

      toast.info("Waiting for transaction confirmation...");

      // Add timeout for transaction confirmation
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(
            () => reject(new Error("Transaction confirmation timeout")),
            180000
          ) // 3 minutes timeout
      );

      const receipt = (await Promise.race([
        publicClient.waitForTransactionReceipt({
          hash: zapTx as `0x${string}`,
        }),
        timeoutPromise,
      ])) as { status: boolean } | undefined;

      if (receipt?.status) {
        setShowSuccessModal(true);
        onSuccess?.();
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Zap stake error:", error);

      // Better error handling
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        if (error.message.includes("rejected")) {
          toast.error("Transaction rejected");
        } else if (error.message.toLowerCase().includes("insufficient funds")) {
          toast.error(error.message);
        } else if (error.message.includes("Wallet not found")) {
          toast.error("Wallet not found. Please reconnect.");
        } else if (error.message.includes("confirmation timeout")) {
          toast.error(
            "Transaction is taking longer than expected. Please check your wallet or transaction history."
          );
        } else {
          toast.error("Failed to zap stake. Please try again.");
        }
      } else {
        toast.error("An unexpected error occurred");
      }
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
            Token rewards are now being streamed directly to your wallet.
          </p>
          <a
            href={`https://explorer.superfluid.finance/base-mainnet/accounts/${user?.wallet?.address}?tab=pools`}
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
    </>
  );
}
