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

const columnHelper = createColumnHelper<Token>();

const PriceChange = ({ value }: { value: number | undefined }) => {
  const marketChange = value ?? 0;
  const isPositive = marketChange >= 0;
  return (
    <div
      className={`font-mono text-right ${
        isPositive ? "text-green-500" : "text-red-500"
      }`}
    >
      {isPositive ? "+" : ""}
      {marketChange.toFixed(2)}%
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
        price?: number;
        change1h?: number;
        change24h?: number;
        volume24h?: number;
        marketCap?: number;
      }
    >
  >(new Map());

  useEffect(() => {
    tokens.forEach(async (token) => {
      // Fetch rewards data
      const { totalStreamed, totalStakers } = await calculateRewards(
        token.created_at,
        token.contract_address,
        token.staking_pool
      );

      // Only fetch market data if we have a pool address
      const marketData = token.pool_address
        ? await fetchPoolData(token.pool_address)
        : null;

      setTokenData((prev) =>
        new Map(prev).set(token.contract_address, {
          rewards: totalStreamed,
          stakers: totalStakers,
          ...marketData,
        })
      );
    });
  }, [tokens]);

  // Update column cells to use the new data
  const columns = [
    columnHelper.accessor("name", {
      header: () => (
        <div className="flex items-center gap-2 cursor-pointer hover:text-primary">
          Token
          <span className="opacity-50">▼</span>
        </div>
      ),
      cell: (info) => (
        <Link
          href={`/token/${info.row.original.contract_address}`}
          className="flex items-center gap-2 hover:underline"
        >
          <span className="font-semibold">{info.getValue()}</span>
          <span className="text-gray-500">{info.row.original.symbol}</span>
        </Link>
      ),
    }),
    columnHelper.accessor("price", {
      header: () => (
        <div className="text-right cursor-pointer hover:text-primary">
          Price
          <span className="opacity-50 ml-2">▼</span>
        </div>
      ),
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        return (
          <div className="font-mono text-right">
            $
            {(data?.price ?? 0).toLocaleString(undefined, {
              minimumFractionDigits: 6,
              maximumFractionDigits: 6,
            })}
          </div>
        );
      },
    }),
    columnHelper.accessor("change1h", {
      header: () => <div className="text-right">1h</div>,
      cell: (info) => <PriceChange value={info.getValue()} />,
    }),
    columnHelper.accessor("change24h", {
      header: () => <div className="text-right">24h</div>,
      cell: (info) => {
        const data = tokenData.get(info.row.original.contract_address);
        return <PriceChange value={data?.change24h ?? info.getValue()} />;
      },
    }),
    columnHelper.accessor("change7d", {
      header: () => <div className="text-right">7d</div>,
      cell: (info) => <PriceChange value={info.getValue()} />,
    }),
    columnHelper.accessor("volume24h", {
      header: () => <div className="text-right">24h Volume</div>,
      cell: (info) => (
        <div className="font-mono text-right">
          ${(info.getValue() ?? 0).toLocaleString()}
        </div>
      ),
    }),
    columnHelper.accessor("marketCap", {
      header: () => <div className="text-right">Market Cap</div>,
      cell: (info) => (
        <div className="font-mono text-right">
          ${(info.getValue() ?? 0).toLocaleString()}
        </div>
      ),
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
  ];

  const table = useReactTable({
    data: tokens,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
                    className="border-b border-black/[.1] dark:border-white/[.1] h-12 px-4 text-left font-[family-name:var(--font-geist-mono)] text-sm"
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
                    className="border-b border-black/[.1] dark:border-white/[.1] h-12 px-4 text-sm"
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
