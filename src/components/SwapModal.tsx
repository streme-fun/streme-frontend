"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { parseEther } from "viem";
import { Modal } from "./Modal";
import { SwapButton } from "./SwapButton";
import { Token } from "@/src/app/types/token";
import { useTokenPrice } from "@/src/hooks/useTokenPrice";

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: Token;
  onSuccess?: () => void;
}

export function SwapModal({
  isOpen,
  onClose,
  token,
  onSuccess,
}: SwapModalProps) {
  // Trading interface state
  const [tradeDirection, setTradeDirection] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("0.001"); // Default to 0.001 ETH for buying
  const [priceQuote, setPriceQuote] = useState<{
    buyAmount: string;
    sellAmount: string;
    liquidityAvailable: boolean;
  } | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Use centralized price cache for token prices, separate logic for ETH
  const { price: tokenPrice } = useTokenPrice(token.contract_address, {
    refreshInterval: 300000, // 5 minutes  
    autoRefresh: true,
  });

  // ETH price - use separate state since useTokenPrice doesn't handle ETH
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  // Fetch ETH price using original method
  useEffect(() => {
    const fetchETHPrice = async () => {
      try {
        const response = await fetch("/api/eth-price");
        if (response.ok) {
          const data = await response.json();
          setEthPrice(data.eth || null);
        }
      } catch (error) {
        console.warn("Error fetching ETH price:", error);
      }
    };

    fetchETHPrice();
    const interval = setInterval(fetchETHPrice, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Helper function to format USD values (replaces convertToUSD)
  const formatUSD = (amount: string | number, price: number | null): string | null => {
    if (!price || !amount) return null;

    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount <= 0) return null;

    const usdValue = numAmount * price;

    if (usdValue < 0.01) {
      return `$${usdValue.toFixed(6)}`;
    } else if (usdValue < 1) {
      return `$${usdValue.toFixed(4)}`;
    } else {
      return `$${usdValue.toFixed(2)}`;
    }
  };

  // Create stable references for contract addresses
  const contractAddress = useMemo(() => {
    return token.contract_address;
  }, [token.contract_address]);

  // Enhanced 0x API integration
  const getGaslessQuote = useCallback(
    async (amount: string, direction: "buy" | "sell") => {
      if (!amount || parseFloat(amount) <= 0) return null;

      setIsPriceLoading(true);
      try {
        let sellToken: string;
        let buyToken: string;

        if (direction === "buy") {
          // ETH -> Token swap
          const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
          sellToken = ETH_ADDRESS;
          buyToken = contractAddress;
        } else {
          // Token -> ETH swap
          const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
          sellToken = contractAddress;
          buyToken = ETH_ADDRESS;
        }

        const sellAmount = parseEther(amount).toString();

        const params = new URLSearchParams({
          chainId: "8453",
          sellToken,
          buyToken,
          sellAmount,
        });

        const response = await fetch(`/api/price?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to get quote");

        const data = await response.json();
        if (data.liquidityAvailable === false) {
          throw new Error("No liquidity available for this token pair");
        }

        return data;
      } catch (error) {
        console.error("Quote error:", error);
        return null;
      } finally {
        setIsPriceLoading(false);
      }
    },
    [contractAddress]
  );

  // USD prices are now handled by useTokenPrice hooks above

  // Debounced quote fetching
  useEffect(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      setPriceQuote(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      getGaslessQuote(tradeAmount, tradeDirection).then(setPriceQuote);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [tradeAmount, tradeDirection, getGaslessQuote]);

  // Handle percentage button clicks for selling
  const handlePercentageClick = useCallback((percentage: number) => {
    // This would need token balance data - simplified for now
    const calculatedAmount = (0.1 * percentage) / 100; // Placeholder calculation
    setTradeAmount(calculatedAmount.toFixed(6));
  }, []);

  // Handle fixed ETH amount clicks for buying
  const handleFixedAmountClick = useCallback((amount: number) => {
    setTradeAmount(amount.toString());
  }, []);

  // Reset to default amount when switching trade direction
  useEffect(() => {
    if (tradeDirection === "buy") {
      setTradeAmount("0.001"); // Default to 0.001 ETH for buying
    } else {
      setTradeAmount(""); // Clear amount for selling
    }
  }, [tradeDirection]);

  const handleClose = () => {
    onClose();
    // Reset state when closing
    setTradeAmount("0.001");
    setTradeDirection("buy");
    setPriceQuote(null);
  };

  const handleSuccess = () => {
    onSuccess?.();
    // Reset to appropriate default
    setTradeAmount(tradeDirection === "buy" ? "0.001" : "");
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Trade {token.symbol}</h3>
          <div className="flex items-center gap-2">
            <img
              src={token.img_url || "/default-token.png"}
              alt={token.symbol}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm font-medium">{token.symbol}</span>
          </div>
        </div>

        {/* Buy/Sell Toggle */}
        <div className="bg-gray-50 rounded-lg p-1 flex">
          <button
            onClick={() => setTradeDirection("buy")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tradeDirection === "buy"
                ? "bg-accent text-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setTradeDirection("sell")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tradeDirection === "sell"
                ? "bg-error text-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
            }`}
          >
            Sell
          </button>
        </div>

        {/* Amount Input */}
        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium text-gray-700">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              placeholder={tradeDirection === "buy" ? "0.001" : ""}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-base font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              step="0.001"
              min="0"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              {tradeDirection === "buy" ? "ETH" : token.symbol}
            </div>
            {/* USD equivalent for trade amount */}
            {tradeAmount && (
              <div className="absolute left-3 bottom-[-20px] text-xs text-gray-400">
                {tradeDirection === "buy"
                  ? formatUSD(tradeAmount, ethPrice)
                  : tradeDirection === "sell"
                  ? formatUSD(tradeAmount, tokenPrice)
                  : null}
              </div>
            )}
          </div>

          {/* Percentage/Amount Buttons */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {tradeDirection === "buy"
              ? // Fixed ETH amounts for buying
                [0.001, 0.01, 0.1, 1].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleFixedAmountClick(amount)}
                    className="py-1 px-2 text-xs rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-500 cursor-pointer"
                  >
                    {amount} eth
                  </button>
                ))
              : // Percentage buttons for selling
                [25, 50, 75, 100].map((percentage) => (
                  <button
                    key={percentage}
                    onClick={() => handlePercentageClick(percentage)}
                    className="py-1 px-2 text-xs font-medium rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-500 cursor-pointer"
                  >
                    {percentage}%
                  </button>
                ))}
          </div>
        </div>

        {/* Quote Display */}
        {isPriceLoading ? (
          <div className="text-center text-gray-500">
            <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto"></div>
          </div>
        ) : priceQuote && tradeAmount ? (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span>Receive:</span>
              <div className="text-right">
                <span className="font-semibold">
                  {(() => {
                    const amount = Number(priceQuote.buyAmount) / 1e18;
                    if (tradeDirection === "sell") {
                      // For selling (receiving ETH), show more decimals if amount is small
                      if (amount < 0.001) {
                        return amount.toFixed(8);
                      } else if (amount < 0.01) {
                        return amount.toFixed(6);
                      } else if (amount < 0.1) {
                        return amount.toFixed(5);
                      } else {
                        return amount.toFixed(4);
                      }
                    } else {
                      // For buying (receiving tokens), use standard 3 decimals
                      return amount.toFixed(3);
                    }
                  })()}{" "}
                  {tradeDirection === "buy" ? token.symbol : "ETH"}
                </span>
                {/* USD equivalent for receive amount */}
                {(() => {
                  const amount = Number(priceQuote.buyAmount) / 1e18;
                  const price =
                    tradeDirection === "buy" ? tokenPrice : ethPrice;
                  
                  return formatUSD(amount, price) ? (
                    <div className="text-xs text-gray-400 mt-1">
                      ≈ {formatUSD(amount, price)}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        ) : null}

        {/* Action Button */}
        <SwapButton
          tokenAddress={contractAddress as `0x${string}`}
          direction={tradeDirection}
          amount={tradeAmount}
          quote={priceQuote}
          symbol={token.symbol}
          onSuccess={handleSuccess}
          disabled={
            !tradeAmount ||
            parseFloat(tradeAmount) <= 0 ||
            !priceQuote?.liquidityAvailable
          }
          className={`w-full btn ${
            tradeDirection === "buy"
              ? "border-accent bg-accent/20 text-accent-content hover:bg-accent/30"
              : "border-error bg-error/10 text-error-content hover:bg-error/20"
          }`}
        />
      </div>
    </Modal>
  );
}
