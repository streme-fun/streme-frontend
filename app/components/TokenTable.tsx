"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Token } from "../types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";
import Image from "next/image";
import { useRouter } from "next/navigation";
// import { StakeButton } from "./StakeButton";

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
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Smoothly animate to new value
    const frameDuration = 50; // 20 fps
    const frames = 20; // 1 second animation
    const increment = (value - displayValue) / frames;

    let frame = 0;
    const interval = setInterval(() => {
      if (frame >= frames) {
        setDisplayValue(value);
        clearInterval(interval);
        return;
      }

      setDisplayValue((prev) => prev + increment);
      frame++;
    }, frameDuration);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="font-mono text-right">
      {displayValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </div>
  );
};

// Add a helper function for price formatting
const formatPrice = (price: number | undefined) => {
  if (!price || isNaN(price)) return "-";

  if (price < 0.01 && price > 0) {
    // Find the first non-zero decimal place
    const decimalStr = price.toFixed(20).split(".")[1];
    let zeroCount = 0;
    while (decimalStr[zeroCount] === "0") {
      zeroCount++;
    }

    // Format as 0.0₅984 (example)
    return (
      <span className="whitespace-nowrap">
        $0.0{zeroCount > 0 && <sub>{zeroCount}</sub>}
        {decimalStr.slice(zeroCount, zeroCount + 4)}
      </span>
    );
  }

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
  const router = useRouter();
  const [rewardsData, setRewardsData] = useState<Map<string, number>>(
    new Map()
  );
  const [membersData, setMembersData] = useState<Map<string, string>>(
    new Map()
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "marketCap", desc: true },
  ]);

  // Memoize the data calculations
  const calculateAllData = useCallback(async () => {
    const promises = tokens.map(async (token) => {
      const { totalStreamed, totalMembers } = await calculateRewards(
        token.created_at,
        token.contract_address,
        token.staking_pool
      );
      return {
        address: token.contract_address,
        rewards: totalStreamed,
        members: totalMembers,
      };
    });

    const results = await Promise.all(promises);
    const newRewardsData = new Map();
    const newMembersData = new Map();
    results.forEach(({ address, rewards, members }) => {
      newRewardsData.set(address, rewards);
      newMembersData.set(address, members);
    });
    setRewardsData(newRewardsData);
    setMembersData(newMembersData);
  }, [tokens]);

  // Initial data load
  useEffect(() => {
    calculateAllData();
  }, [calculateAllData]);

  // Update rewards periodically with better performance
  useEffect(() => {
    const interval = setInterval(() => {
      setRewardsData((prev) => {
        const updated = new Map(prev);
        for (const [key, value] of updated.entries()) {
          updated.set(key, value + REWARDS_PER_SECOND);
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Memoize the columns to prevent unnecessary re-renders
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => (
          <div className="flex items-center gap-2 text-xs">Token</div>
        ),
        cell: (info) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/token/${info.row.original.contract_address}`}
              className="flex items-center gap-2 hover:underline text-xs relative z-50"
              onClick={(e) => {
                e.preventDefault();
                router.push(`/token/${info.row.original.contract_address}`);
              }}
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
        header: () => <div className="text-right w-full">Price</div>,
        cell: (info) => (
          <div className="font-mono text-right">
            {formatPrice(info.row.original.price)}
          </div>
        ),
      }),
      columnHelper.accessor("change24h", {
        header: () => <div className="text-right w-full">24h</div>,
        cell: (info) => <PriceChange value={info.row.original.change24h} />,
      }),
      columnHelper.accessor("volume24h", {
        header: () => <div className="text-right w-full">24h Volume</div>,
        cell: (info) => (
          <div className="font-mono text-right">
            {formatCurrency(info.row.original.volume24h)}
          </div>
        ),
      }),
      columnHelper.accessor("marketCap", {
        header: () => <div className="text-right w-full">Market Cap</div>,
        cell: (info) => (
          <div className="font-mono text-right">
            {formatCurrency(info.row.original.marketCap)}
          </div>
        ),
      }),
      columnHelper.accessor("rewardDistributed", {
        header: () => (
          <div className="text-right w-full">Rewards Distributed</div>
        ),
        cell: (info) => {
          const rewards = rewardsData.get(info.row.original.contract_address);
          return rewards !== undefined ? (
            <AnimatedReward value={rewards} />
          ) : (
            <div className="font-mono text-right">-</div>
          );
        },
      }),
      columnHelper.accessor("staking_pool", {
        header: () => <div className="text-right w-full">Stakers</div>,
        cell: (info) => {
          const members = membersData.get(info.row.original.contract_address);
          return (
            <div className="font-mono text-right">
              {members ? (
                <span className="text-primary">
                  {parseInt(members).toLocaleString()}
                </span>
              ) : (
                "-"
              )}
            </div>
          );
        },
      }),
      // Comment out the actions column
      /*
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
              membersData={membersData}
            />
          );
        },
      }),
      */
    ],
    [rewardsData, membersData]
  );

  const table = useReactTable({
    data: tokens,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[800px] border-separate border-spacing-0">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-black/[.1] dark:border-white/[.1] h-10 px-4 text-left font-[family-name:var(--font-geist-mono)] text-xs"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{
                      cursor: header.column.getCanSort()
                        ? "pointer"
                        : "default",
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.original.contract_address}
                className="hover:bg-black/[.02] dark:hover:bg-white/[.02] relative"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="border-b border-black/[.1] dark:border-white/[.1] h-10 px-4 text-xs relative"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Remove or comment out the entire ActionButtons component
/*
const ActionButtons = ({
  tokenAddress,
  token,
  onBuy,
  membersData,
}: {
  tokenAddress: string;
  token: Token;
  onBuy: (address: string) => void;
  membersData: Map<string, string>;
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
        stakingPoolAddress={token.staking_pool}
        disabled={!hasTokens}
        symbol={token.symbol}
        totalStakers={membersData.get(tokenAddress)}
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
*/
