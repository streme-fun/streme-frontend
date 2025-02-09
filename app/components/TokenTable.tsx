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

const columnHelper = createColumnHelper<Token>();

const PriceChange = ({ value }: { value: number | undefined }) => {
  const isPositive = (value ?? 0) >= 0;
  return (
    <div
      className={`font-mono text-right ${
        isPositive ? "text-green-500" : "text-red-500"
      }`}
    >
      {(value ?? 0).toFixed(1)}%
    </div>
  );
};

const AnimatedReward = ({
  initial,
  rate,
}: {
  initial: number;
  rate: number;
}) => {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue((prev) => prev + rate / 20);
    }, 50);

    return () => clearInterval(interval);
  }, [rate]);

  return (
    <div className="font-mono text-right">
      $
      {value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </div>
  );
};

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
      const price = info.getValue() ?? 0;
      const decimals = price < 0.01 ? 6 : price < 1 ? 4 : 2;
      return (
        <div className="font-mono text-right">
          $
          {price.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
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
    cell: (info) => <PriceChange value={info.getValue()} />,
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
    cell: (info) => (
      <AnimatedReward
        initial={info.getValue() ?? 0}
        rate={info.row.original.rewardRate ?? 0}
      />
    ),
  }),
  columnHelper.accessor("stakingAPY", {
    header: () => <div className="text-right">Staking APY</div>,
    cell: (info) => (
      <div className="font-mono text-right">
        {(info.getValue() ?? 0).toFixed(2)}%
      </div>
    ),
  }),
];

interface TokenTableProps {
  tokens: Token[];
}

export function TokenTable({ tokens }: TokenTableProps) {
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
                key={row.id}
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
