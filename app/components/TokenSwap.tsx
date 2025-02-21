"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { parseUnits, formatUnits } from "viem";
import qs from "qs";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { truncateAddress } from "@/lib/truncateAddress";
import { QuoteResponse } from "@/lib/types/zerox";

interface Token {
  symbol: string;
  name: string;
  image: string;
  address: string;
  decimals: number;
}

const ETH = {
  symbol: "ETH",
  name: "Ethereum",
  image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  decimals: 18,
};

const DEMO_TOKENS: Token[] = [
  {
    symbol: "STREME",
    name: "STREME",
    image: "/avatars/streme.png",
    address: "0x3B3Cd21242BA44e9865B066e5EF5d1cC1030CC58",
    decimals: 18,
  },
];

export default function TokenSwap() {
  const sellToken = ETH;
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const buyToken = DEMO_TOKENS[0];

  const [isFinalized, setIsFinalized] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse>();

  const [fetchPriceError, setFetchPriceError] = useState([]);

  const { user, login, ready } = usePrivy();
  const { wallets } = useWallets();
  const address = user?.wallet?.address;
  const isConnected = !!address;
  const [isPending, setIsPending] = useState(false);
  const [hash, setHash] = useState<string>();
  const [sendTransactionError, setSendTransactionError] = useState<Error>();

  const parsedSellAmount = sellAmount
    ? parseUnits(sellAmount, sellToken.decimals).toString()
    : undefined;

  const [isPriceLoading, setIsPriceLoading] = useState(false);

  const finalize = useCallback(() => {
    setIsFinalized(true);
  }, []);

  const fetchPrice = useCallback(
    async (params: unknown) => {
      setIsPriceLoading(true);
      try {
        const response = await fetch(`/api/price?${qs.stringify(params)}`);
        const data = await response.json();

        if (data?.validationErrors?.length > 0) {
          setFetchPriceError(data.validationErrors);
        } else {
          setFetchPriceError([]);
        }

        if (data.buyAmount) {
          setBuyAmount(formatUnits(data.buyAmount, buyToken.decimals));
        }
      } finally {
        setIsPriceLoading(false);
      }
    },
    [buyToken.decimals]
  );

  const linkToBaseScan = useCallback((hash?: string) => {
    if (hash) {
      window.open(`https://basescan.org/tx/${hash}`, "_blank");
    }
  }, []);

  const fetchQuote = useCallback(async (params: unknown) => {
    setIsPriceLoading(true);
    try {
      const response = await fetch(`/api/quote?${qs.stringify(params)}`);
      const data = await response.json();
      setQuote(data);
    } finally {
      setIsPriceLoading(false);
    }
  }, []);

  const executeSwap = useCallback(async () => {
    if (!quote || !user?.wallet?.address) return;

    try {
      setIsPending(true);
      const wallet = wallets.find((w) => w.address === user.wallet?.address);

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const provider = await wallet.getEthereumProvider();

      try {
        const tx = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: quote.transaction.to,
              from: user.wallet.address,
              data: quote.transaction.data,
              value: `0x${BigInt(quote.transaction.value).toString(16)}`,
            },
          ],
        });

        setHash(tx as string);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string" &&
          error.message.includes("rejected")
        ) {
          setSendTransactionError(new Error("Transaction rejected"));
        } else {
          console.error("Error executing swap:", error);
          setSendTransactionError(new Error("Failed to execute swap"));
        }
      }
    } catch (error) {
      console.error("Error setting up connection:", error);
      setSendTransactionError(new Error("Failed to setup connection"));
    } finally {
      setIsPending(false);
    }
  }, [quote, user?.wallet?.address, wallets]);

  useEffect(() => {
    const params = {
      chainId: 8453,
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: parsedSellAmount,
      taker: address,
    };

    const timeoutId = setTimeout(() => {
      if (sellAmount !== "") {
        const fetchFn = isFinalized ? fetchQuote : fetchPrice;
        fetchFn(params);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [
    address,
    buyToken.address,
    parsedSellAmount,
    sellAmount,
    sellToken.address,
    isFinalized,
    fetchPrice,
    fetchQuote,
  ]);

  useEffect(() => {
    if (!address || !quote) return;

    if (quote.issues?.allowance) {
      console.log("Allowance needed for Permit2");
    }
  }, [address, quote]);

  return (
    <div className="card w-[300px] shadow-xl mx-auto p-4">
      <div className="mb-4">
        {address && (
          <div className="text-sm text-base-content/60 text-right">
            {truncateAddress(address)}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Sell Token Input */}
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={sellAmount}
            onChange={(e) => {
              const value = e.target.value;
              // Limit to 4 decimal places
              if (value.includes(".") && value.split(".")[1].length > 4) {
                setSellAmount(Number(value).toFixed(4));
              } else {
                setSellAmount(value);
              }
            }}
            step="0.0001"
            placeholder="0.0"
            className="input input-bordered w-full"
          />
          <div className="absolute right-2 top-2 flex items-center gap-2 px-2 py-1 rounded-btn">
            <Image
              src={ETH.image}
              alt={ETH.symbol}
              width={100}
              height={100}
              className="w-6 h-6 rounded-full"
            />
            <div className="font-medium">{ETH.symbol}</div>
          </div>
        </div>

        {/* Quick Amount Button */}
        <button
          onClick={() => setSellAmount("0.0001")}
          className="btn btn-sm btn-outline w-full"
        >
          Set 0.0001 ETH
        </button>

        {/* Buy Token Input */}
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={buyAmount}
            onChange={(e) => {
              const value = e.target.value;
              // Limit to 4 decimal places
              if (value.includes(".") && value.split(".")[1].length > 4) {
                setBuyAmount(Number(value).toFixed(4));
              } else {
                setBuyAmount(value);
              }
            }}
            step="0.0001"
            placeholder="0.0"
            className="input input-bordered w-full"
          />
          {isPriceLoading && (
            <div className="absolute inset-0 flex items-center justify-center  rounded-btn">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          )}
          <div className="absolute right-2 top-2 flex items-center gap-2 px-2 py-1 rounded-btn">
            <Image
              src={buyToken.image}
              alt={buyToken.symbol}
              width={100}
              height={100}
              className="w-6 h-6 rounded-full"
            />
            <div className="font-medium">{buyToken.symbol}</div>
          </div>
        </div>

        <button
          onClick={isConnected ? (isFinalized ? executeSwap : finalize) : login}
          disabled={
            !ready ||
            (!isConnected && !login) ||
            !sellAmount ||
            !buyAmount ||
            isPending
          }
          className="btn btn-primary w-full"
        >
          {isConnected
            ? isFinalized
              ? "Confirm"
              : "Review Swap"
            : "Connect Wallet"}
        </button>

        {quote && (
          <div className="mt-4 space-y-2 text-sm">
            <div>
              Min. Received:{" "}
              {formatUnits(BigInt(quote.minBuyAmount), buyToken.decimals)}{" "}
              {buyToken.symbol}
            </div>
            <div>Gas Estimate: {quote.gas} gas units</div>
            {quote.fees?.zeroExFee && (
              <div>
                Fee:{" "}
                {formatUnits(
                  BigInt(quote.fees.zeroExFee.amount),
                  buyToken.decimals
                )}{" "}
                {quote.fees.zeroExFee.token}
              </div>
            )}
          </div>
        )}
        {isPending && (
          <div className="text-warning text-center mt-4">
            ⏳ Waiting for confirmation...
          </div>
        )}
        {hash && (
          <div
            className="text-success text-center mt-4 cursor-pointer"
            onClick={() => linkToBaseScan(hash)}
          >
            <p>🎉 Transaction Confirmed!</p>
            <p className="text-sm">Tap to View on Basescan</p>
          </div>
        )}

        {fetchPriceError.length > 0 && (
          <div className="text-error text-sm mt-2">
            {fetchPriceError.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        )}
        {sendTransactionError && (
          <div className="text-error text-sm mt-2">
            Error: {sendTransactionError.message}
          </div>
        )}
      </div>
    </div>
  );
}
