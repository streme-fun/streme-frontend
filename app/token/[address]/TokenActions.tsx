"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useBalance,
  useWriteContract,
  useReadContract,
  useSignTypedData,
} from "wagmi";
import { parseUnits, formatUnits, BaseError, erc20Abi } from "viem";
import qs from "qs";
import { QuoteResponse } from "@/lib/types/zerox";
import { Token } from "@/app/types/token";
import { concat, numberToHex, size, type Hex } from "viem";

const ETH = {
  symbol: "ETH",
  name: "Ethereum",
  image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  decimals: 18,
};

const AFFILIATE_FEE = 25;
const PROTOCOL_GUILD_ADDRESS = "0x32e3C7fD24e175701A35c224f2238d18439C7dBC";

const formatBalance = (value: bigint, decimals: number, forInput = false) => {
  // Get the raw string value with full precision
  const rawFormatted = formatUnits(value, decimals);

  // For input values, return the raw formatted string without commas
  if (forInput) {
    return rawFormatted;
  }

  // Split into whole and decimal parts for display
  const [whole, decimal] = rawFormatted.split(".");
  const formattedWhole = parseInt(whole).toLocaleString();

  // Return with appropriate decimal places
  return decimal ? `${formattedWhole}.${decimal.slice(0, 8)}` : formattedWhole;
};

type Tab = "buy" | "sell" | "stake";

interface TokenActionsProps {
  token: Token;
}

export function TokenActions({ token }: TokenActionsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("buy");
  const [amount, setAmount] = useState<string>("");
  const [rewards, setRewards] = useState(token.rewardDistributed ?? 0);
  const [quote, setQuote] = useState<QuoteResponse>();
  const [fetchPriceError, setFetchPriceError] = useState([]);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

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

  const { data: ethBalance } = useBalance({
    address: address as `0x${string}`,
  });

  const { data: tokenBalance } = useBalance({
    address: address as `0x${string}`,
    token: token.contract_address as `0x${string}`,
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token.contract_address as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as `0x${string}`, quote?.transaction?.to as `0x${string}`],
    query: {
      enabled: !!address && !!quote?.transaction?.to,
    },
  });

  const { writeContractAsync: approve } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const hasEnoughBalance = useCallback(() => {
    if (!amount) return false;
    const parsedAmount = parseUnits(
      amount,
      activeTab === "buy" ? ETH.decimals : token.decimals
    );

    if (activeTab === "buy") {
      return ethBalance?.value ? parsedAmount <= ethBalance.value : false;
    } else {
      return tokenBalance?.value ? parsedAmount <= tokenBalance.value : false;
    }
  }, [
    amount,
    activeTab,
    ethBalance?.value,
    tokenBalance?.value,
    token.decimals,
  ]);

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

  const handlePlaceTrade = async () => {
    if (activeTab === "sell" && quote?.transaction) {
      const spenderAddress = quote.allowanceTarget as `0x${string}`;
      const sellAmount = parseUnits(amount, token.decimals);

      if (!allowance || allowance < sellAmount) {
        try {
          console.log("Approving token spend...");
          await approve({
            address: token.contract_address as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [spenderAddress, sellAmount],
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await refetchAllowance();
        } catch (error) {
          console.error("Approval failed:", error);
          return;
        }
      }
    }

    if (quote?.transaction) {
      if (activeTab === "sell" && quote.permit2?.eip712) {
        try {
          const signature = await signTypedDataAsync(quote.permit2.eip712);
          console.log("Signed permit2 message");

          const signatureLengthInHex = numberToHex(size(signature), {
            signed: false,
            size: 32,
          });

          const transactionData = quote.transaction.data as Hex;
          const sigLengthHex = signatureLengthInHex as Hex;
          const sig = signature as Hex;

          quote.transaction.data = concat([transactionData, sigLengthHex, sig]);
        } catch (error) {
          console.error("Error signing permit2:", error);
          return;
        }
      }

      const value = activeTab === "buy" ? quote.transaction.value : "0";
      console.log("Executing swap with:", {
        to: quote.transaction.to,
        value,
        gas: quote.transaction.gas,
        data: quote.transaction.data,
      });

      sendTransaction({
        to: quote.transaction.to as `0x${string}`,
        data: quote.transaction.data as `0x${string}`,
        value: BigInt(value),
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
      });
    }
  };

  useEffect(() => {
    if (!amount || !address) {
      setQuote(undefined);
      setFetchPriceError([]);
      return;
    }

    const parsedAmount = parseUnits(
      amount,
      activeTab === "buy" ? ETH.decimals : token.decimals
    ).toString();

    const params = {
      chainId: 8453,
      sellToken: activeTab === "buy" ? ETH.address : token.contract_address,
      buyToken: activeTab === "buy" ? token.contract_address : ETH.address,
      sellAmount: parsedAmount,
      taker: address,
      swapFeeRecipient: PROTOCOL_GUILD_ADDRESS,
      swapFeeBps: AFFILIATE_FEE,
      swapFeeToken: activeTab === "buy" ? token.contract_address : ETH.address,
      tradeSurplusRecipient: PROTOCOL_GUILD_ADDRESS,
    };

    const timeoutId = setTimeout(() => {
      if (amount !== "") {
        console.log("Fetching quote with params:", params);
        fetchQuote(params);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [
    address,
    amount,
    activeTab,
    fetchQuote,
    token.contract_address,
    token.decimals,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRewards((prev) => prev + (token.rewardRate ?? 0) / 20);
    }, 50);
    return () => clearInterval(interval);
  }, [token.rewardRate]);

  useEffect(() => {
    if (tokenBalance?.value) {
      console.log("Token Debug:", {
        rawBalance: tokenBalance.value.toString(),
        decimals: token.decimals,
        withDecimals: {
          d10: formatUnits(tokenBalance.value, 10),
          d18: formatUnits(tokenBalance.value, 18),
          dToken: formatUnits(tokenBalance.value, token.decimals),
        },
        formatted: formatBalance(tokenBalance.value, token.decimals),
        token: token.contract_address,
      });
    }
  }, [token.decimals, tokenBalance?.value, token.contract_address]);

  const showPresets = activeTab === "buy";

  const displayQuoteAmount = quote?.minBuyAmount && !isPriceLoading && (
    <div className="text-sm opacity-60 mt-2">
      You will receive:{" "}
      {formatUnits(
        BigInt(quote.minBuyAmount),
        activeTab === "buy" ? token.decimals : ETH.decimals
      )}{" "}
      {activeTab === "buy" ? token.symbol : "ETH"}
    </div>
  );

  return (
    <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
      <div className="card-body p-4">
        {/* Token Info Section */}
        <div className="mb-8 space-y-6">
          {/* Token Header */}
          <div className="flex items-center gap-4">
            {token.img_url ? (
              <div className="relative w-16 h-16">
                <Image
                  src={token.img_url}
                  alt={token.name}
                  fill
                  className="object-cover rounded-full"
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-primary flex items-center justify-center text-primary-content font-mono font-bold rounded-full">
                ${token.symbol}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold mb-1">{token.name}</h2>
              <div className="flex items-center gap-3">
                <span className="text-base opacity-60">${token.symbol}</span>
                <span
                  className={`text-base ${
                    (token.marketCapChange ?? 0) >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {(token.marketCapChange ?? 0) >= 0 ? "+" : ""}
                  {(token.marketCapChange ?? 0).toFixed(2)}%
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
                  ${(token.marketCap ?? 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-base opacity-60 mb-2">24h Volume</div>
                <div className="font-mono text-xl">
                  ${(token.volume24h ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-base opacity-60 mb-2">Staking APY</div>
                <div className="font-mono text-xl text-green-500">
                  {(token.stakingAPY ?? 0).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-base opacity-60 mb-2">Total Stakers</div>
                <div className="font-mono text-xl">-</div>
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
              {(token.rewardRate ?? 0).toFixed(2)} ${token.symbol}/sec
            </div>
          </div>

          {/* Creator Info */}
          {token.creator && (
            <div className="flex items-center gap-2">
              <div className="avatar">
                <div className="w-6 h-6 rounded-full">
                  {token.creator.profileImage ? (
                    <Image
                      src={token.creator.profileImage}
                      alt={token.creator.name}
                      width={24}
                      height={24}
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-mono">
                      {token.creator.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-base opacity-60">{token.creator.name}</span>
              <div className="flex items-center gap-3 ml-auto opacity-60">
                <span>🔄 {token.creator.recasts}</span>
                <span>❤️ {token.creator.likes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 btn ${
              activeTab === "buy"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => {
              setActiveTab("buy");
              setAmount("");
            }}
          >
            BUY
          </button>
          <button
            className={`flex-1 btn ${
              activeTab === "sell"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => {
              setActiveTab("sell");
              setAmount("");
            }}
          >
            SELL
          </button>
          <button
            className={`flex-1 btn ${
              activeTab === "stake"
                ? "btn-primary"
                : "btn-ghost bg-black/[.02] dark:bg-white/[.02]"
            }`}
            onClick={() => {
              setActiveTab("stake");
              setAmount("");
            }}
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
            <div className="flex items-center gap-2">
              {activeTab === "sell" && tokenBalance && (
                <button
                  className="btn btn-xs btn-ghost"
                  onClick={() => {
                    // Use raw formatUnits for the input value
                    setAmount(formatUnits(tokenBalance.value, token.decimals));
                  }}
                >
                  Max
                </button>
              )}
              <span>
                Balance:{" "}
                {activeTab === "buy"
                  ? ethBalance
                    ? formatBalance(ethBalance.value, ETH.decimals)
                    : "0.0000"
                  : tokenBalance
                  ? formatBalance(tokenBalance.value, token.decimals)
                  : "0.0000"}{" "}
                {activeTab === "buy" ? "ETH" : token.symbol}
              </span>
            </div>
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
              {activeTab === "buy" ? "ETH" : token.symbol}
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
          onClick={() => {
            if (!isConnected) {
              login();
              return;
            }
            handlePlaceTrade();
          }}
          disabled={
            !ready ||
            isPending ||
            (!isConnected && !login) ||
            (isConnected && (!amount || !hasEnoughBalance()))
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
