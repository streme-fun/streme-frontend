"use client";

import { useEffect, useState, useCallback } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import Image from "next/image";
import { parseUnits, formatUnits, BaseError } from "viem";
import qs from "qs";
import { usePrivy } from "@privy-io/react-auth";

import { truncateAddress } from "@/src/lib/truncateAddress";
import { QuoteResponse } from "@/src/lib/types/zerox";
import { getPrices, convertToUSD } from "@/src/lib/priceUtils";

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
    symbol: "MOXIE",
    name: "Moxie",
    image:
      "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    address: "0x8c9037d1ef5c6d1f6816278c7aaf5491d24cd527",
    decimals: 6,
  },
  {
    symbol: "CLANKER",
    name: "Clanker",
    image:
      "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/295953fa-15ed-4d3c-241d-b6c1758c6200/original",
    address: "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb",
    decimals: 18,
  },
];

const AFFILIATE_FEE = 25;
const PROTOCOL_GUILD_ADDRESS = "0x32e3C7fD24e175701A35c224f2238d18439C7dBC";

export default function TokenSwap({ token }: { token: string }) {
  const sellToken = ETH;
  const [sellAmount, setSellAmount] = useState("");

  const [buyAmount, setBuyAmount] = useState("");
  const [buyToken, setBuyToken] = useState<Token>(
    token === "clanker" ? DEMO_TOKENS[1] : DEMO_TOKENS[0]
  );

  const [isFinalized, setIsFinalized] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse>();

  const [fetchPriceError, setFetchPriceError] = useState([]);

  // USD price states
  const [usdPrices, setUsdPrices] = useState<{
    eth: number | null;
    token: number | null;
  }>({
    eth: null,
    token: null,
  });

  const { user, login, ready } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = !!address;

  const parsedSellAmount = sellAmount
    ? parseUnits(sellAmount, sellToken.decimals).toString()
    : undefined;

  const parsedBuyAmount = buyAmount
    ? parseUnits(buyAmount, buyToken.decimals).toString()
    : undefined;

  const [isPriceLoading, setIsPriceLoading] = useState(false);

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
    [buyToken.decimals, setBuyAmount, setFetchPriceError]
  );

  const linkToBaseScan = useCallback((hash?: string) => {
    if (hash) {
      window.open(`https://basescan.org/tx/${hash}`, "_blank");
    }
  }, []);

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
    if (quote) {
      sendTransaction({
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: BigInt(quote.transaction.value),
      });
    }
  }, [quote, sendTransaction]);

  // Fetch USD prices
  useEffect(() => {
    const fetchUSDPrices = async () => {
      try {
        const prices = await getPrices([buyToken.address]);
        if (prices) {
          setUsdPrices({
            eth: prices.eth,
            token: prices[buyToken.address.toLowerCase()] || null,
          });
        }
      } catch (error) {
        console.error("Error fetching USD prices:", error);
      }
    };

    fetchUSDPrices();
    // Update prices every minute
    const interval = setInterval(fetchUSDPrices, 60000);
    return () => clearInterval(interval);
  }, [buyToken.address]);

  useEffect(() => {
    const params = {
      chainId: 8453,
      sellToken: ETH.address,
      buyToken: buyToken.address,
      sellAmount: parsedSellAmount,
      buyAmount: parsedBuyAmount,
      taker: address,
      swapFeeRecipient: PROTOCOL_GUILD_ADDRESS,
      swapFeeBps: AFFILIATE_FEE,
      swapFeeToken: buyToken.address,
      tradeSurplusRecipient: PROTOCOL_GUILD_ADDRESS,
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
    buyAmount,
    buyToken.address,
    parsedBuyAmount,
    parsedSellAmount,
    sellAmount,
    isFinalized,
    fetchPrice,
    fetchQuote,
  ]);

  return (
    <div className="card w-[300px] shadow-xl mx-auto p-4">
      <div className="mb-4">
        {address && (
          <div className="text-sm text-base-content/60 text-right">
            {truncateAddress(address)}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Sell Token Input */}
        <div className="relative mb-6">
          <input
            type="number"
            inputMode="decimal"
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
            placeholder="0.0"
            className="input input-bordered w-full"
          />
          {/* USD equivalent for sell amount */}
          {sellAmount && usdPrices.eth && (
            <div className="absolute left-3 bottom-[-20px] text-xs text-gray-500">
              {convertToUSD(sellAmount, usdPrices.eth)}
            </div>
          )}
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

        {/* Buy Token Input */}
        <div className="relative mb-6">
          <input
            type="number"
            inputMode="decimal"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            placeholder="0.0"
            className="input input-bordered w-full"
          />
          {/* USD equivalent for buy amount */}
          {buyAmount && usdPrices.token && (
            <div className="absolute left-3 bottom-[-20px] text-xs text-gray-500">
              {convertToUSD(buyAmount, usdPrices.token)}
            </div>
          )}
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
            <select
              value={buyToken.symbol}
              onChange={(e) =>
                setBuyToken(
                  DEMO_TOKENS.find((t) => t.symbol === e.target.value) ||
                    DEMO_TOKENS[1]
                )
              }
              className="select select-ghost select-sm min-h-0 h-auto"
            >
              {DEMO_TOKENS.map((token) => (
                <option key={token.symbol} value={token.symbol}>
                  {token.symbol}
                </option>
              ))}
            </select>
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
          {isConnected ? (isFinalized ? "Confirm" : "Swap") : "Connect Wallet"}
        </button>

        {quote && (
          <div className="text-sm text-base-content/80">
            <div>
              Receive at least:{" "}
              {formatUnits(BigInt(quote.minBuyAmount), buyToken.decimals)}{" "}
              {buyToken.symbol}
            </div>
            {/* USD equivalent for minimum receive amount */}
            {usdPrices.token && (
              <div className="text-xs text-gray-500 mt-1">
                ≈{" "}
                {convertToUSD(
                  formatUnits(BigInt(quote.minBuyAmount), buyToken.decimals),
                  usdPrices.token
                )}
              </div>
            )}
          </div>
        )}
        {isConfirming && (
          <div className="text-warning text-center mt-4">
            ⏳ Waiting for confirmation...
          </div>
        )}
        {isConfirmed && (
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
        {error && (
          <div className="text-error text-sm mt-2">
            Error: {(error as BaseError).shortMessage || error.message}
          </div>
        )}
      </div>
    </div>
  );
}
