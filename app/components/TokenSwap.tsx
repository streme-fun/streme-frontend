"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  parseUnits,
  formatUnits,
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
  numberToHex,
  concat,
  size,
} from "viem";
import qs from "qs";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { base } from "viem/chains";

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

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export default function TokenSwap() {
  const [isSellETH, setIsSellETH] = useState(true);
  const sellToken = isSellETH ? ETH : DEMO_TOKENS[0];
  const buyToken = isSellETH ? DEMO_TOKENS[0] : ETH;
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");

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

  const [isApproving, setIsApproving] = useState(false);

  const parsedSellAmount = sellAmount
    ? parseUnits(sellAmount, sellToken.decimals).toString()
    : undefined;

  const [isPriceLoading, setIsPriceLoading] = useState(false);

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

  const checkAndSetAllowance = useCallback(async () => {
    if (!user?.wallet?.address || !parsedSellAmount || isSellETH) return true;

    try {
      setIsApproving(true);
      const wallet = wallets.find((w) => w.address === user.wallet?.address);
      if (!wallet) throw new Error("Wallet not found");

      const provider = await wallet.getEthereumProvider();

      // Check current allowance
      const allowanceData = await publicClient.readContract({
        address: sellToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [
          user.wallet.address as `0x${string}`,
          PERMIT2_ADDRESS as `0x${string}`,
        ],
      });

      console.log("Current allowance:", allowanceData.toString());
      console.log("Required amount:", parsedSellAmount);

      if (BigInt(allowanceData) < BigInt(parsedSellAmount)) {
        console.log("Approving PERMIT2...");
        const tx = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              to: sellToken.address,
              from: user.wallet.address,
              data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "approve",
                args: [
                  PERMIT2_ADDRESS as `0x${string}`,
                  BigInt(2) ** BigInt(256) - BigInt(1),
                ],
              }),
            },
          ],
        });

        await publicClient.waitForTransactionReceipt({
          hash: tx as `0x${string}`,
        });
        console.log("Approval complete");
      } else {
        console.log("Already approved");
      }
      return true;
    } catch (error) {
      console.error("Error setting allowance:", error);
      setSendTransactionError(new Error("Failed to approve token"));
      return false;
    } finally {
      setIsApproving(false);
    }
  }, [
    isSellETH,
    parsedSellAmount,
    sellToken.address,
    user?.wallet?.address,
    wallets,
  ]);

  const finalize = useCallback(async () => {
    if (!isSellETH) {
      const approved = await checkAndSetAllowance();
      if (!approved) return;
    }
    setIsFinalized(true);
  }, [isSellETH, checkAndSetAllowance]);

  const executeSwap = useCallback(async () => {
    if (!quote || !user?.wallet?.address) return;

    try {
      setIsPending(true);
      const wallet = wallets.find((w) => w.address === user.wallet?.address);
      if (!wallet) throw new Error("Wallet not found");

      const provider = await wallet.getEthereumProvider();

      // 1. First sign the Permit2 message if it exists
      let signature;
      if (quote.permit2?.eip712) {
        console.log("Signing Permit2 message...");
        try {
          // Sign the EIP-712 data
          signature = await provider.request({
            method: "eth_signTypedData_v4",
            params: [user.wallet.address, JSON.stringify(quote.permit2.eip712)],
          });
          console.log("Signature obtained:", signature);
        } catch (error) {
          console.error("Error signing Permit2 message:", error);
          throw new Error("Failed to sign Permit2 message");
        }
      }

      // 2. Prepare the transaction data with signature
      let txData = quote.transaction.data;
      if (signature) {
        console.log("Appending signature to transaction data...");
        // Convert signature length to 32-byte hex
        const signatureLengthInHex = numberToHex(
          size(signature as `0x${string}`),
          {
            signed: false,
            size: 32,
          }
        );
        // Concatenate original data with signature length and signature
        txData = concat([
          txData as `0x${string}`,
          signatureLengthInHex,
          signature as `0x${string}`,
        ]) as `0x${string}`;
      }

      // 3. Send the transaction with the complete data
      console.log("Sending transaction...");
      const tx = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: quote.transaction.to,
            from: user.wallet.address,
            data: txData,
            value: `0x${BigInt(quote.transaction.value || "0").toString(16)}`,
          },
        ],
      });

      setHash(tx as string);
      console.log("Transaction sent:", tx);
    } catch (error: unknown) {
      console.error("Error executing swap:", error);
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.includes("rejected")
      ) {
        setSendTransactionError(new Error("Transaction rejected"));
      } else {
        setSendTransactionError(new Error("Failed to execute swap"));
      }
    } finally {
      setIsPending(false);
    }
  }, [quote, user?.wallet?.address, wallets]);

  const switchTokens = useCallback(() => {
    setIsSellETH(!isSellETH);
    setSellAmount("");
    setBuyAmount("");
    setIsFinalized(false);
    setQuote(undefined);
  }, [isSellETH]);

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
              src={sellToken.image}
              alt={sellToken.symbol}
              width={100}
              height={100}
              className="w-6 h-6 rounded-full"
            />
            <div className="font-medium">{sellToken.symbol}</div>
          </div>
        </div>

        {/* Switch and Quick Amount Buttons */}
        <div className="flex gap-2">
          <button
            onClick={switchTokens}
            className="btn btn-sm btn-outline flex-1"
          >
            🔄 Switch
          </button>
          <button
            onClick={() => setSellAmount(isSellETH ? "0.0001" : "300000")}
            className="btn btn-sm btn-outline flex-1"
          >
            Set {isSellETH ? "0.0001" : "300000"} {sellToken.symbol}
          </button>
        </div>

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
          onClick={async () => {
            if (!isConnected) {
              login();
            } else if (isFinalized) {
              await executeSwap();
            } else {
              await finalize();
            }
          }}
          disabled={
            !ready ||
            (!isConnected && !login) ||
            !sellAmount ||
            !buyAmount ||
            isPending ||
            isApproving
          }
          className="btn btn-primary w-full"
        >
          {isConnected
            ? isApproving
              ? "Approving..."
              : isFinalized
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
