"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { parseUnits, formatUnits, BaseError } from "viem";
import qs from "qs";
import { QuoteResponse } from "@/lib/types/zerox";

// Using one of the mock tokens from TokenGrid
const tokenInfo = {
  name: "Moxie",
  symbol: "MOXIE",
  address: "0x8c9037d1ef5c6d1f6816278c7aaf5491d24cd527",
  decimals: 18,
  marketCap: 20258149,
  marketCapChange: 15.0,
  volume24h: 12420,
  imageUrl: "/tokens/skimochi.avif",
  creator: {
    name: "zeni",
    score: 79,
    recasts: 17,
    likes: 62,
  },
  createdAt: "2 months ago",
  staking: {
    apy: 156.8,
    stakers: 1247,
    totalStaked: 245690,
    rewardsDistributed: 123456.78,
    rewardRate: 1.85, // Per second
  },
};

type Tab = "buy" | "sell" | "stake";

const ETH = {
  symbol: "ETH",
  name: "Ethereum",
  image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  decimals: 18,
};

const AFFILIATE_FEE = 25;
const PROTOCOL_GUILD_ADDRESS = "0x32e3C7fD24e175701A35c224f2238d18439C7dBC";

// Add a helper function at the top of the file
const formatBalance = (value: bigint, decimals: number) => {
  return parseFloat(formatUnits(value, decimals)).toFixed(4);
};

export function TokenActions() {
  const [activeTab, setActiveTab] = useState<Tab>("buy");
  const [amount, setAmount] = useState<string>("");
  const [rewards, setRewards] = useState(tokenInfo.staking.rewardsDistributed);
  const [quote, setQuote] = useState<QuoteResponse>();
  const [fetchPriceError, setFetchPriceError] = useState([]);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // More realistic ETH amounts (0.1, 0.5, 1.0)
  const presetAmounts = ["0.01", "0.05", "0.1"];

  const { user, login, ready } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = !!address;

  const {
    data: hash,
    isPending,
    error,
    sendTransaction,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Update the ETH balance check
  const { data: ethBalance } = useBalance({
    address: address as `0x${string}`,
  });

  const { data: tokenBalance } = useBalance({
    address: address as `0x${string}`,
    token: tokenInfo.address as `0x${string}`,
  });

  // Helper to check if user has enough balance
  const hasEnoughBalance = useCallback(() => {
    if (!amount) return false;
    const parsedAmount = parseUnits(amount, 18);

    if (activeTab === "buy") {
      return ethBalance?.value ? parsedAmount <= ethBalance.value : false;
    } else {
      return tokenBalance?.value ? parsedAmount <= tokenBalance.value : false;
    }
  }, [amount, activeTab, ethBalance?.value, tokenBalance?.value]);

  const handlePresetClick = (value: string) => {
    setAmount(value);
  };

  const handleReset = () => {
    setAmount("");
  };

  const fetchQuote = useCallback(
    async (params: unknown) => {
      setIsPriceLoading(true);
      try {
        const response = await fetch(`/api/quote?${qs.stringify(params)}`);
        const data = await response.json();
        setQuote(data);
      } finally {
        setIsPriceLoading(false);
      }
    },
    [setIsPriceLoading, setQuote]
  );

  const executeSwap = useCallback(() => {
    if (quote?.transaction) {
      sendTransaction({
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
        to: quote.transaction.to as `0x${string}`,
        data: quote.transaction.data as `0x${string}`,
        value: BigInt(quote.transaction.value),
      });
    }
  }, [quote, sendTransaction]);

  useEffect(() => {
    if (!amount || !address) {
      // Clear quote and errors when amount is empty
      setQuote(undefined);
      setFetchPriceError([]);
      return;
    }

    const parsedAmount = parseUnits(
      amount,
      activeTab === "buy" ? ETH.decimals : tokenInfo.decimals
    ).toString();

    const params = {
      chainId: 8453,
      sellToken: activeTab === "buy" ? ETH.address : tokenInfo.address,
      buyToken: activeTab === "buy" ? tokenInfo.address : ETH.address,
      sellAmount: parsedAmount,
      taker: address,
      swapFeeRecipient: PROTOCOL_GUILD_ADDRESS,
      swapFeeBps: AFFILIATE_FEE,
      swapFeeToken: activeTab === "buy" ? tokenInfo.address : ETH.address,
      tradeSurplusRecipient: PROTOCOL_GUILD_ADDRESS,
    };

    const timeoutId = setTimeout(() => {
      if (amount !== "") {
        fetchQuote(params);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [address, amount, activeTab, fetchQuote]);

  const handlePlaceTrade = () => {
    if (!isConnected) {
      login();
      return;
    }

    executeSwap();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + tokenInfo.staking.rewardRate / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Only show preset amounts for buy tab
  const showPresets = activeTab === "buy";

  // Update the quote display in the JSX
  const displayQuoteAmount = quote?.minBuyAmount && !isPriceLoading && (
    <div className="text-sm opacity-60 mt-2">
      You will receive:{" "}
      {formatUnits(
        BigInt(quote.minBuyAmount),
        activeTab === "buy" ? tokenInfo.decimals : ETH.decimals
      )}{" "}
      {activeTab === "buy" ? tokenInfo.symbol : "ETH"}
    </div>
  );

  return (
    <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
      <div className="card-body p-4">
        {/* Token Info Section */}
        <div className="mb-8 space-y-6">
          {/* Token Header */}
          <div className="flex items-center gap-4">
            {tokenInfo.imageUrl ? (
              <div className="relative w-16 h-16">
                <Image
                  src={tokenInfo.imageUrl}
                  alt={tokenInfo.name}
                  fill
                  className="object-cover rounded-full"
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-primary flex items-center justify-center text-primary-content font-mono font-bold rounded-full">
                ${tokenInfo.symbol}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold mb-1">{tokenInfo.name}</h2>
              <div className="flex items-center gap-3">
                <span className="text-base opacity-60">
                  ${tokenInfo.symbol}
                </span>
                <span
                  className={`text-base ${
                    tokenInfo.marketCapChange >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {tokenInfo.marketCapChange >= 0 ? "+" : ""}
                  {tokenInfo.marketCapChange.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Market Stats */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-base opacity-60 mb-2">Market Cap</div>
                <div className="font-mono text-xl">
                  ${tokenInfo.marketCap.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-base opacity-60 mb-2">24h Volume</div>
                <div className="font-mono text-xl">
                  ${tokenInfo.volume24h.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-base opacity-60 mb-2">Staking APY</div>
                <div className="font-mono text-xl text-green-500">
                  {tokenInfo.staking.apy.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-base opacity-60 mb-2">Total Stakers</div>
                <div className="font-mono text-xl">
                  {tokenInfo.staking.stakers.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Rewards Counter */}
          <div>
            <div className="text-base opacity-60 mb-2">Rewards Distributed</div>
            <div className="font-mono text-2xl font-bold text-primary">
              $
              {rewards.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-sm opacity-40 mt-1">
              {tokenInfo.staking.rewardRate.toFixed(2)} $FWOG/sec
            </div>
          </div>

          {/* Creator Info */}
          <div className="flex items-center gap-2">
            <div className="avatar">
              <div className="w-6 h-6 rounded-full">
                <Image
                  src={`/avatars/${tokenInfo.creator.name}.avif`}
                  alt={tokenInfo.creator.name}
                  width={24}
                  height={24}
                />
              </div>
            </div>
            <span className="text-base opacity-60">
              {tokenInfo.creator.name}
            </span>
            <div className="flex items-center gap-3 ml-auto opacity-60">
              <span>🔄 {tokenInfo.creator.recasts}</span>
              <span>❤️ {tokenInfo.creator.likes}</span>
            </div>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 btn ${
              activeTab === "buy"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => setActiveTab("buy")}
          >
            BUY
          </button>
          <button
            className={`flex-1 btn ${
              activeTab === "sell"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => setActiveTab("sell")}
          >
            SELL
          </button>
          <button
            className={`flex-1 btn ${
              activeTab === "stake"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => setActiveTab("stake")}
          >
            STAKE
          </button>
        </div>

        {/* Max Slippage Button */}
        <button className="btn btn-sm btn-ghost bg-black/[.02] dark:bg-white/[.02] w-fit mb-4">
          SET MAX SLIPPAGE
        </button>

        {/* Amount Input */}
        <div className="relative mb-4">
          <div className="flex justify-between mb-2 text-sm opacity-60">
            <span>Amount</span>
            <span>
              Balance:{" "}
              {activeTab === "buy"
                ? ethBalance
                  ? formatBalance(ethBalance.value, ETH.decimals)
                  : "0.0000"
                : tokenBalance
                ? formatBalance(tokenBalance.value, tokenInfo.decimals)
                : "0.0000"}{" "}
              {activeTab === "buy" ? "ETH" : tokenInfo.symbol}
            </span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input input-ghost bg-black/[.02] dark:bg-white/[.02] w-full pr-20 font-mono text-2xl"
            disabled={isPriceLoading}
          />
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            <span className="font-mono">
              {activeTab === "buy" ? "ETH" : tokenInfo.symbol}
            </span>
          </div>
          {isPriceLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          )}
        </div>

        {/* Only show preset amounts for buy tab */}
        {showPresets && (
          <div className="flex gap-2 mb-4">
            <button
              className="btn btn-sm btn-ghost bg-black/[.02] dark:bg-white/[.02]"
              onClick={handleReset}
            >
              RESET
            </button>
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                className="btn btn-sm btn-ghost bg-black/[.02] dark:bg-white/[.02]"
                onClick={() => handlePresetClick(preset)}
              >
                {preset} ETH
              </button>
            ))}
          </div>
        )}

        {/* Place Trade Button */}
        <button
          className="btn btn-primary w-full"
          onClick={handlePlaceTrade}
          disabled={
            !ready ||
            (!isConnected && !login) ||
            !amount ||
            isPending ||
            !hasEnoughBalance()
          }
        >
          {!isConnected
            ? "Connect Wallet"
            : !hasEnoughBalance()
            ? "Insufficient Balance"
            : activeTab === "buy"
            ? "Buy Now"
            : "Sell Now"}
        </button>

        {displayQuoteAmount}

        {/* Add transaction status messages */}
        {isConfirming && (
          <div className="text-warning text-center mt-4">
            ⏳ Waiting for confirmation...
          </div>
        )}
        {isConfirmed && (
          <div className="text-success text-center mt-4">
            🎉 Transaction Confirmed!
          </div>
        )}
        {/* Add error messages */}
        {fetchPriceError.length > 0 && (
          <div className="text-error text-sm mt-2">
            {fetchPriceError.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        )}
        {error &&
          (error as BaseError).shortMessage?.includes("simulation failed") && (
            <div className="text-error text-sm mt-2">
              Transaction simulation failed. This usually means the trade cannot
              be executed at the current price. Please try a different amount or
              try again later.
            </div>
          )}
      </div>
    </div>
  );
}
