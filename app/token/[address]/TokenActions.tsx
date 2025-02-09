"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Token } from "@/app/types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";
import { fetchPoolData } from "@/app/lib/geckoterminal";
import { StakeButton } from "@/app/components/StakeButton";
import { UniswapModal } from "@/app/components/UniswapModal";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import Image from "next/image";
import FarcasterIcon from "@/public/farcaster.svg";

// Helper functions from TokenTable
const formatPrice = (price: number | undefined) => {
  if (!price || isNaN(price)) return "-";

  if (price < 0.000001) {
    const scientificStr = price.toExponential(2);
    const [base, exponent] = scientificStr.split("e");
    return (
      <span className="whitespace-nowrap">
        ${base}
        <span className="text-xs opacity-60">×10{exponent}</span>
      </span>
    );
  }

  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  })}`;
};

const formatCurrency = (value: number | undefined) => {
  if (!value || isNaN(value)) return "-";
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

interface TokenActionsProps {
  token: Token;
}

const AnimatedReward = ({ value }: { value: number }) => {
  const [current, setCurrent] = useState(value);

  // Update initial value when it changes
  useEffect(() => {
    setCurrent(value);
  }, [value]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => prev + REWARDS_PER_SECOND / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-lg">
      {current.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </div>
  );
};

const shortenHash = (hash: string | undefined) => {
  if (!hash) return "";
  return hash.slice(0, 10);
};

export function TokenActions({ token }: TokenActionsProps) {
  const [isUniswapOpen, setIsUniswapOpen] = useState(false);
  const [tokenData, setTokenData] = useState<{
    rewards: number;
    stakers: number;
    totalMembers?: string;
    price?: number;
    change1h?: number;
    change24h?: number;
    volume24h?: number;
    marketCap?: number;
  }>();

  const { user, ready } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = ready && !!address;
  const [balance, setBalance] = useState<bigint>(BigInt(0));

  // Fetch token data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { totalStreamed, totalStakers, totalMembers } =
          await calculateRewards(
            token.created_at,
            token.contract_address,
            token.staking_pool
          );

        const marketData = token.pool_address
          ? await fetchPoolData(token.pool_address)
          : null;

        setTokenData({
          rewards: totalStreamed,
          stakers: totalStakers,
          totalMembers,
          ...marketData,
        });
      } catch (error) {
        console.error("Error fetching token data:", error);
      }
    };

    fetchData();
  }, [token]);

  // Fetch balance
  useEffect(() => {
    if (!address || !isConnected) return;

    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const fetchBalance = async () => {
      const bal = await publicClient.readContract({
        address: token.contract_address as `0x${string}`,
        abi: [
          {
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      setBalance(bal);
    };

    fetchBalance();
  }, [address, isConnected, token.contract_address]);

  const hasTokens = isConnected && balance > 0n;

  return (
    <div className="space-y-6">
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
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-2xl font-mono">
            {token.symbol?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{token.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base opacity-60">${token.symbol}</span>
            <span
              className={`text-base ${
                tokenData?.change24h && tokenData.change24h >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {tokenData?.change24h
                ? `${
                    tokenData.change24h >= 0 ? "+" : ""
                  }${tokenData.change24h.toFixed(2)}%`
                : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Price Row */}
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="text-sm opacity-60 mb-1">Price</div>
          <div className="font-mono text-2xl font-bold">
            {formatPrice(tokenData?.price)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm opacity-60 mb-1">24h Change</div>
          <div
            className={`font-mono text-lg ${
              tokenData?.change24h && tokenData.change24h >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {tokenData?.change24h
              ? `${
                  tokenData.change24h >= 0 ? "+" : ""
                }${tokenData.change24h.toFixed(2)}%`
              : "-"}
          </div>
        </div>
      </div>

      {/* Creator Info */}
      {token.creator && (
        <div className="flex items-center gap-2 px-1">
          <div className="avatar">
            <div className="w-6 h-6 rounded-full">
              <Image
                src={
                  token.creator.profileImage ??
                  `/avatars/${token.creator.name}.avif`
                }
                alt={token.creator.name}
                width={24}
                height={24}
              />
            </div>
          </div>
          <a
            href={`https://warpcast.com/${token.creator.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base opacity-60 hover:opacity-100 hover:underline"
          >
            {token.creator.name}
          </a>
          {token.cast_hash && (
            <a
              href={`https://warpcast.com/${token.creator.name}/${shortenHash(
                token.cast_hash
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary inline-flex items-center ml-2"
              title="View original cast"
            >
              <Image
                src={FarcasterIcon}
                alt="View on Farcaster"
                width={14}
                height={14}
                className="opacity-60 hover:opacity-100"
              />
            </a>
          )}
        </div>
      )}

      {/* Market Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm opacity-60 mb-1">Volume 24h</div>
          <div className="font-mono text-lg">
            {formatCurrency(tokenData?.volume24h)}
          </div>
        </div>
        <div>
          <div className="text-sm opacity-60 mb-1">Market Cap</div>
          <div className="font-mono text-lg">
            {formatCurrency(tokenData?.marketCap)}
          </div>
        </div>
      </div>

      {/* Rewards Section */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-sm opacity-60 mb-1">
            Rewards ({tokenData?.totalMembers ?? 0}{" "}
            {tokenData?.totalMembers === "1" ? "staker" : "stakers"})
          </div>
          <AnimatedReward value={tokenData?.rewards ?? 0} />
        </div>
        <div className="text-sm opacity-40">
          {REWARDS_PER_SECOND.toFixed(2)} ${token.symbol}/sec
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsUniswapOpen(true)}
          className="btn btn-primary flex-1"
        >
          Buy
        </button>
        <StakeButton
          tokenAddress={token.contract_address}
          stakingAddress={token.staking_pool}
          stakingPool={token.staking_pool}
          disabled={!hasTokens}
          symbol={token.symbol}
          totalStakers={tokenData?.totalMembers}
          className={`btn btn-outline flex-1 relative 
            before:absolute before:inset-0 before:bg-gradient-to-r 
            before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f] 
            before:scale-x-0 hover:before:scale-x-100 
            before:origin-left before:opacity-0 hover:before:opacity-20
            hover:border-[#ffa647]/50
            hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]
            ${!hasTokens && "btn-disabled opacity-50"}`}
        />
      </div>

      <UniswapModal
        isOpen={isUniswapOpen}
        onClose={() => setIsUniswapOpen(false)}
        tokenAddress={token.contract_address}
      />
    </div>
  );
}
