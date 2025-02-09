"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Token } from "../types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";
import { fetchPoolData } from "@/app/lib/geckoterminal";
import Image from "next/image";
import { UniswapModal } from "./UniswapModal";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { StakeButton } from "./StakeButton";

const columnHelper = createColumnHelper<Token>();

const PriceChange = ({ value }: { value: number | undefined }) => {
  if (value === undefined || value === null) {
    return <div className="font-mono text-right">-</div>;
  }
  const isPositive = value >= 0;
  return (
    <div
      className={`font-mono text-right ${
        isPositive ? "text-green-500" : "text-red-500"
      }`}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </div>
  );
};

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
    <div className="font-mono text-right">
      {current.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </div>
  );
};

// Add a helper function for price formatting
const formatPrice = (price: number | undefined) => {
  if (!price || isNaN(price)) return "-";

  // For very small numbers (< 0.000001), use scientific notation
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

  // For regular numbers, use standard formatting
  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  })}`;
};

// Add a helper for formatting large numbers
const formatCurrency = (value: number | undefined) => {
  if (!value || isNaN(value)) return "-";
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

interface TokenTableProps {
  tokens: Token[];
}

export function TokenTable({ tokens }: TokenTableProps) {
  const [tokenData, setTokenData] = useState<
    Map<
      string,
      {
        rewards: number;
        stakers: number;
        totalMembers?: string;
        price?: number;
        change1h?: number;
        change24h?: number;
        volume24h?: number;
        marketCap?: number;
      }
    >
  >(new Map());

  // Add state for modal
  const [isUniswapOpen, setIsUniswapOpen] = useState(false);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true); // Set loading when tokens change

    const fetchData = async () => {
      try {
        const promises = tokens.map(async (token) => {
          const { totalStreamed, totalStakers, totalMembers } =
            await calculateRewards(
              token.created_at,
              token.contract_address,
              token.staking_pool
            );

          const marketData = token.pool_address
            ? await fetchPoolData(token.pool_address)
            : null;

          return {
            address: token.contract_address,
            data: {
              rewards: totalStreamed,
              stakers: totalStakers,
              totalMembers,
              ...marketData,
            },
          };
        });

        const results = await Promise.all(promises);
        const newTokenData = new Map();
        results.forEach(({ address, data }) => newTokenData.set(address, data));
        setTokenData(newTokenData);
      } catch (error) {
        console.error("Error fetching token data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tokens]);

  // Update column cells to use the new data
  const columns = [
    columnHelper.accessor("name", {
      header: () => (
        <div className="flex items-center gap-2 text-xs">Token</div>
      ),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/token/${info.row.original.contract_address}`}
            className="flex items-center gap-2 hover:underline text-xs"
          >
            {info.row.original.img_url ? (
              <div className="w-5 h-5 relative rounded-full overflow-hidden">
                <Image
                  src={info.row.original.img_url}
                  alt={info.getValue()}
                  fill
                  sizes="20px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-[10px] font-mono">
                {info.row.original.symbol?.[0] ?? "?"}
              </div>
            )}
            <span className="font-medium">{info.getValue()}</span>
          </Link>
        </div>
      ),
    }),
    columnHelper.accessor("price", {
      header: () => <div className="text-right">Price</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        const price = data?.price;
        return <div className="font-mono text-right">{formatPrice(price)}</div>;
      },
    }),
    columnHelper.accessor("change1h", {
      header: () => <div className="text-right">1h</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        return <PriceChange value={data?.change1h ?? info.getValue()} />;
      },
    }),
    columnHelper.accessor("change24h", {
      header: () => <div className="text-right">24h</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        return <PriceChange value={data?.change24h ?? info.getValue()} />;
      },
    }),
    columnHelper.accessor("volume24h", {
      header: () => <div className="text-right">24h Volume</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        return (
          <div className="font-mono text-right">
            {formatCurrency(data?.volume24h)}
          </div>
        );
      },
    }),
    columnHelper.accessor("marketCap", {
      header: () => <div className="text-right">Market Cap</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        return (
          <div className="font-mono text-right">
            {formatCurrency(data?.marketCap)}
          </div>
        );
      },
    }),
    columnHelper.accessor("rewardDistributed", {
      header: () => <div className="text-right">Rewards Distributed</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        return data ? (
          <AnimatedReward value={data.rewards} />
        ) : (
          <div className="font-mono text-right">0.00</div>
        );
      },
    }),
    columnHelper.accessor("staking_pool", {
      header: () => <div className="text-right">Stakers</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        console.log("Stakers data:", {
          address: info.row.original.contract_address,
          data,
        });
        return (
          <div className="font-mono text-right">
            {data?.totalMembers ? (
              <span className="text-primary">
                {parseInt(data.totalMembers).toLocaleString()}
              </span>
            ) : (
              "-"
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor("pool_address", {
      header: () => <div className="text-center">Actions</div>,
      cell: (info) => {
        const token = info.row.original;
        return (
          <ActionButtons
            tokenAddress={token.contract_address}
            token={token}
            onBuy={(address) => {
              setSelectedTokenAddress(address);
              setIsUniswapOpen(true);
            }}
            tokenData={tokenData}
          />
        );
      },
    }),
  ];

  const table = useReactTable({
    data: tokens,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Update skeleton to include stakers column
  const TableSkeleton = () => (
    <div className="animate-pulse">
      <table className="w-full min-w-[800px] border-separate border-spacing-0">
        <thead>
          <tr>
            {/* Token column - wider for name */}
            <th className="h-10 px-4 text-left">
              <div className="h-4 w-24 bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
            </th>
            {/* Price column */}
            <th className="h-10 px-4 text-right">
              <div className="h-4 w-20 ml-auto bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
            </th>
            {/* 1h, 24h columns - smaller */}
            {[...Array(2)].map((_, i) => (
              <th key={i} className="h-10 px-4 text-right">
                <div className="h-4 w-12 ml-auto bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
              </th>
            ))}
            {/* Volume, Market Cap, Stakers - medium width */}
            {[...Array(3)].map((_, i) => (
              <th key={i + 2} className="h-10 px-4 text-right">
                <div className="h-4 w-16 ml-auto bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
              </th>
            ))}
            {/* Actions column */}
            <th className="h-10 px-4 text-center">
              <div className="h-4 w-24 mx-auto bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
            </th>
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-black/[.02] dark:hover:bg-white/[.02]"
            >
              {/* Token cell with image + name */}
              <td className="h-10 px-4 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] opacity-20 animate-shimmer" />
                <div className="h-4 w-24 bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
              </td>
              {/* Other cells with varying widths */}
              <td className="h-10 px-4">
                <div className="h-4 w-20 ml-auto bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
              </td>
              {[...Array(4)].map((_, i) => (
                <td key={i} className="h-10 px-4">
                  <div className="h-4 w-16 ml-auto bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
                </td>
              ))}
              {/* Actions cell */}
              <td className="h-10 px-4">
                <div className="flex justify-center gap-2">
                  <div className="h-6 w-12 bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
                  <div className="h-6 w-12 bg-gradient-to-r from-[#ff75c3] via-[#ffa647] to-[#ffe83f] rounded opacity-20 animate-shimmer" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="w-full overflow-x-auto">
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <table className="w-full min-w-[800px] border-separate border-spacing-0">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-b border-black/[.1] dark:border-white/[.1] h-10 px-4 text-left font-[family-name:var(--font-geist-mono)] text-xs"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.original.contract_address}
                  className="hover:bg-black/[.02] dark:hover:bg-white/[.02]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-b border-black/[.1] dark:border-white/[.1] h-10 px-4 text-xs"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <UniswapModal
        isOpen={isUniswapOpen}
        onClose={() => setIsUniswapOpen(false)}
        tokenAddress={selectedTokenAddress}
      />
    </div>
  );
}

const ActionButtons = ({
  tokenAddress,
  token,
  onBuy,
  tokenData,
}: {
  tokenAddress: string;
  token: Token;
  onBuy: (address: string) => void;
  tokenData: Map<string, { totalMembers?: string }>;
}) => {
  const { user, ready } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = ready && !!address;

  const [balance, setBalance] = useState<bigint>(BigInt(0));

  useEffect(() => {
    if (!address || !isConnected) return;

    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const fetchBalance = async () => {
      const bal = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
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
  }, [address, isConnected, tokenAddress]);

  const hasTokens = isConnected && balance > 0n;

  const data = tokenData.get(tokenAddress);

  return (
    <div className="flex justify-center gap-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBuy(tokenAddress);
        }}
        className="btn btn-xs btn-primary normal-case font-normal
          hover:bg-primary/90 hover:shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]"
      >
        Buy
      </button>
      <StakeButton
        tokenAddress={tokenAddress}
        stakingAddress={token.staking_address}
        stakingPool={token.staking_pool}
        disabled={!hasTokens}
        symbol={token.symbol}
        totalStakers={data?.totalMembers}
        className={`btn btn-xs btn-outline normal-case font-normal relative 
          before:absolute before:inset-0 before:bg-gradient-to-r 
          before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f] 
          before:scale-x-0 hover:before:scale-x-100 
          before:origin-left before:opacity-0 hover:before:opacity-20
          hover:border-[#ffa647]/50
          hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]
          ${!hasTokens && "btn-disabled opacity-50"}`}
      />
    </div>
  );
};
