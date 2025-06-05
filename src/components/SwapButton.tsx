"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { toast } from "sonner";
import { publicClient } from "@/src/lib/viemClient";
import { sdk } from "@farcaster/frame-sdk";
import { useWalletClient } from "wagmi";
import confetti from "canvas-confetti";

interface SwapButtonProps {
  tokenAddress: string;
  direction: "buy" | "sell";
  amount: string;
  quote: {
    buyAmount: string;
    sellAmount: string;
    liquidityAvailable: boolean;
  } | null;
  symbol: string;
  onSuccess?: () => void;
  isMiniApp?: boolean;
  farcasterAddress?: string;
  farcasterIsConnected?: boolean;
  className?: string;
  disabled?: boolean;
}

export function SwapButton({
  tokenAddress,
  direction,
  amount,
  quote,
  symbol,
  onSuccess,
  isMiniApp,
  farcasterAddress,
  farcasterIsConnected,
  className,
  disabled,
}: SwapButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: walletClient } = useWalletClient();

  const effectiveIsConnected = isMiniApp
    ? farcasterIsConnected
    : !!walletClient?.account?.address;

  // Use the actual connected wallet account address, not user.wallet.address
  const effectiveAddress = isMiniApp
    ? farcasterAddress
    : walletClient?.account?.address;

  // Confetti function for celebrations
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#ff75c3", "#ffa647", "#ffe83f", "#9f7aea", "#4fd1c7"],
    });
  };

  const performSwap = async () => {
    if (!effectiveAddress || !effectiveIsConnected || !amount || !quote) {
      toast.error("Missing required data for swap");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading(
      direction === "buy"
        ? `Preparing to buy ${symbol}...`
        : `Preparing to sell ${symbol}...`,
      {
        style: {
          background: "linear-gradient(135deg, #e0f2fe 0%, #f3e8ff 100%)",
          border: "1px solid #0ea5e9",
          borderRadius: "8px",
        },
      }
    );

    try {
      await performRegularSwap(toastId);
    } catch (error) {
      console.error("Swap error:", error);
      let message = "Swap failed. Please try again.";

      if (typeof error === "object" && error !== null && "message" in error) {
        const errorMessage = (error as { message: string }).message;
        if (
          errorMessage.includes("User rejected") ||
          errorMessage.includes("cancelled")
        ) {
          message = "Transaction cancelled by user.";
        } else if (errorMessage.includes("Insufficient")) {
          message = errorMessage;
        } else if (errorMessage.includes("liquidity")) {
          message = "Insufficient liquidity available for this trade.";
        } else {
          message = errorMessage.substring(0, 100);
        }
      }

      toast.error(message, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const checkAndSetAllowance = async (
    spenderAddress: string,
    requiredAmount: string
  ) => {
    if (!walletClient || !effectiveAddress) {
      throw new Error("Wallet not available");
    }

    // Check current allowance
    const currentAllowance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
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
      ],
      functionName: "allowance",
      args: [
        effectiveAddress as `0x${string}`,
        spenderAddress as `0x${string}`,
      ],
    });

    const requiredAmountBigInt = BigInt(requiredAmount);

    // If allowance is sufficient, no need to approve
    if (currentAllowance >= requiredAmountBigInt) {
      return;
    }

    // Set approval for the required amount
    const approvalTxHash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "approve",
      args: [spenderAddress as `0x${string}`, requiredAmountBigInt],
    });

    // Wait for approval transaction to be confirmed
    await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
  };

  const performRegularSwap = async (toastId: string | number) => {
    if (!walletClient || !effectiveAddress) {
      throw new Error("Wallet not available");
    }

    let sellToken: string;
    let buyToken: string;

    if (direction === "buy") {
      // ETH -> Token swap
      const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      sellToken = ETH_ADDRESS;
      buyToken = tokenAddress;
    } else {
      // Token -> ETH swap (using regular API instead of gasless)
      const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      sellToken = tokenAddress;
      buyToken = ETH_ADDRESS;
    }

    const sellAmount = parseEther(amount).toString();

    // Get quote using regular API for both directions
    const quoteParams = new URLSearchParams({
      chainId: "8453",
      sellToken,
      buyToken,
      sellAmount,
      taker: effectiveAddress,
    });

    const quoteResponse = await fetch(`/api/quote?${quoteParams.toString()}`);
    if (!quoteResponse.ok) {
      throw new Error(`Quote API error: ${quoteResponse.statusText}`);
    }

    const quoteData = await quoteResponse.json();
    if (quoteData.liquidityAvailable === false) {
      throw new Error("No liquidity available for this token pair");
    }
    if (!quoteData.transaction) {
      throw new Error("Invalid quote response");
    }

    // Check if we need to handle token allowance for selling
    if (direction === "sell" && quoteData.issues?.allowance) {
      const allowanceIssue = quoteData.issues.allowance;
      const currentAllowance = BigInt(allowanceIssue.actual || "0");
      const requiredAllowance = BigInt(sellAmount);

      if (currentAllowance < requiredAllowance) {
        toast.loading("🔐 Approving token spending...", {
          id: toastId,
          style: {
            background: "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)",
            border: "1px solid #f59e0b",
            borderRadius: "8px",
          },
        });
        await checkAndSetAllowance(allowanceIssue.spender, sellAmount);
        toast.loading("✅ Token approval confirmed! Preparing swap...", {
          id: toastId,
          style: {
            background: "linear-gradient(135deg, #f0fff4 0%, #dcfce7 100%)",
            border: "1px solid #22c55e",
            borderRadius: "8px",
          },
        });
      }
    }

    toast.loading(
      direction === "buy"
        ? "✍️ Please sign the purchase transaction..."
        : "✍️ Please sign the sale transaction...",
      {
        id: toastId,
        style: {
          background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
          border: "1px solid #0ea5e9",
          borderRadius: "8px",
        },
      }
    );

    let transactionData = quoteData.transaction.data;

    // For Permit2, we need to sign the EIP-712 message and append it
    if (quoteData.permit2?.eip712) {
      const signature = await walletClient.signTypedData(
        quoteData.permit2.eip712
      );

      const { concat, numberToHex, size } = await import("viem");
      const signatureLengthInHex = numberToHex(size(signature), {
        signed: false,
        size: 32,
      });
      transactionData = concat([
        transactionData,
        signatureLengthInHex,
        signature,
      ]);
    }

    toast.loading(
      direction === "buy"
        ? `⚡ Executing purchase of ${symbol}...`
        : `⚡ Executing sale of ${symbol}...`,
      {
        id: toastId,
        style: {
          background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
          border: "1px solid #f59e0b",
          borderRadius: "8px",
        },
      }
    );

    let txHash: `0x${string}`;

    if (isMiniApp) {
      const ethProvider = sdk.wallet.ethProvider;
      if (!ethProvider)
        throw new Error("Farcaster Ethereum provider not available.");

      txHash = await ethProvider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: quoteData.transaction.to,
            from: effectiveAddress as `0x${string}`,
            data: transactionData,
            value: `0x${BigInt(quoteData.transaction.value || "0").toString(
              16
            )}`,
            gas: `0x${BigInt(quoteData.transaction.gas).toString(16)}`,
          },
        ],
      });
    } else {
      // Don't specify account, let walletClient use its connected account
      txHash = await walletClient.sendTransaction({
        to: quoteData.transaction.to as `0x${string}`,
        data: transactionData,
        value: BigInt(quoteData.transaction.value || "0"),
        gas: BigInt(quoteData.transaction.gas),
      });
    }

    toast.loading("Confirming transaction on blockchain...", {
      id: toastId,
      style: {
        background: "linear-gradient(135deg, #fef3c7 0%, #ddd6fe 100%)",
        border: "1px solid #a78bfa",
        borderRadius: "8px",
      },
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Dismiss the loading toast first to prevent conflicts
    toast.dismiss(toastId);

    if (direction === "buy") {
      toast.success(`🎉 Purchase Successful!`, {
        duration: 4000,
        style: {
          background: "linear-gradient(135deg, #fff5f5 0%, #f0fff4 100%)",
          border: "2px solid #48bb78",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: "500",
        },
      });

      triggerConfetti();
    } else {
      toast.success(`💰 Sale Successful!`, {
        duration: 4000,
        style: {
          background: "linear-gradient(135deg, #fef5e7 0%, #f0f9ff 100%)",
          border: "2px solid #3182ce",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: "500",
        },
      });
    }

    onSuccess?.();
  };

  const isDisabled =
    disabled ||
    isLoading ||
    !amount ||
    parseFloat(amount) <= 0 ||
    !quote?.liquidityAvailable ||
    !effectiveIsConnected;

  return (
    <button onClick={performSwap} disabled={isDisabled} className={className}>
      {isLoading ? "Processing..." : "Place Trade"}
    </button>
  );
}
