"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";

type Token = {
  name: string;
  symbol: string;
  marketCap: number;
  price: number;
  volume24h: number;
  stakingAPY: number;
  change1h: number;
  change24h: number;
  change7d: number;
  rewardDistributed: number;
  rewardRate: number;
};

const columnHelper = createColumnHelper<Token>();

const PriceChange = ({ value }: { value: number }) => {
  const isPositive = value >= 0;
  return (
    <div
      className={`font-mono text-right ${
        isPositive ? "text-green-500" : "text-red-500"
      }`}
    >
      {value.toFixed(1)}%
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
    header: "Token",
    cell: (info) => (
      <div className="flex items-center gap-2">
        <span className="font-semibold">{info.getValue()}</span>
        <span className="text-gray-500">{info.row.original.symbol}</span>
      </div>
    ),
  }),
  columnHelper.accessor("price", {
    header: () => <div className="text-right">Price</div>,
    cell: (info) => {
      const price = info.getValue();
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
        ${info.getValue().toLocaleString()}
      </div>
    ),
  }),
  columnHelper.accessor("marketCap", {
    header: () => <div className="text-right">Market Cap</div>,
    cell: (info) => (
      <div className="font-mono text-right">
        ${info.getValue().toLocaleString()}
      </div>
    ),
  }),
  columnHelper.accessor("rewardDistributed", {
    header: () => <div className="text-right">Rewards Distributed</div>,
    cell: (info) => (
      <AnimatedReward
        initial={info.getValue()}
        rate={info.row.original.rewardRate}
      />
    ),
  }),
  columnHelper.accessor("stakingAPY", {
    header: () => <div className="text-right">Staking APY</div>,
    cell: (info) => (
      <div className="font-mono text-right">{info.getValue().toFixed(2)}%</div>
    ),
  }),
];

const defaultData: Token[] = [
  {
    name: "StreamPepe",
    symbol: "SPEPE",
    marketCap: 15800000,
    price: 0.0042,
    volume24h: 892467,
    stakingAPY: 12.5,
    change1h: 0.5,
    change24h: -2.3,
    change7d: -8.7,
    rewardDistributed: 234567.89,
    rewardRate: 3.17,
  },
  {
    name: "FlowDoge",
    symbol: "FLOWG",
    marketCap: 8500000,
    price: 0.0156,
    volume24h: 453219,
    stakingAPY: 15.75,
    change1h: 1.2,
    change24h: 3.4,
    change7d: -5.6,
    rewardDistributed: 123456.78,
    rewardRate: 2.15,
  },
  {
    name: "RiverRocket",
    symbol: "RVRKT",
    marketCap: 22500000,
    price: 0.089,
    volume24h: 1234567,
    stakingAPY: 8.25,
    change1h: -0.8,
    change24h: 5.2,
    change7d: 12.3,
    rewardDistributed: 456789.12,
    rewardRate: 4.28,
  },
  {
    name: "WaterfallInu",
    symbol: "WFINU",
    marketCap: 4200000,
    price: 0.00023,
    volume24h: 318654,
    stakingAPY: 18.5,
    change1h: 2.1,
    change24h: -1.5,
    change7d: -15.8,
    rewardDistributed: 89123.45,
    rewardRate: 1.82,
  },
  {
    name: "StreamShiba",
    symbol: "STRSHIB",
    marketCap: 12500000,
    price: 0.0078,
    volume24h: 678932,
    stakingAPY: 14.2,
    change1h: 0.3,
    change24h: -0.7,
    change7d: 4.5,
    rewardDistributed: 178234.56,
    rewardRate: 2.45,
  },
  {
    name: "TorrentMoon",
    symbol: "TRMOON",
    marketCap: 3800000,
    price: 0.00012,
    volume24h: 248756,
    stakingAPY: 20.1,
    change1h: 0.1,
    change24h: 0.5,
    change7d: 8.2,
    rewardDistributed: 67123.89,
    rewardRate: 1.23,
  },
  {
    name: "FluxFloki",
    symbol: "FLXFLK",
    marketCap: 6700000,
    price: 0.0034,
    volume24h: 421879,
    stakingAPY: 16.8,
    change1h: -0.2,
    change24h: 1.8,
    change7d: 6.7,
    rewardDistributed: 145678.9,
    rewardRate: 2.78,
  },
  {
    name: "RapidRabbit",
    symbol: "RPDRBT",
    marketCap: 9100000,
    price: 0.0067,
    volume24h: 547623,
    stakingAPY: 13.9,
    change1h: 0.4,
    change24h: -1.1,
    change7d: -4.2,
    rewardDistributed: 198234.56,
    rewardRate: 2.91,
  },
  {
    name: "CascadeCat",
    symbol: "CSCAT",
    marketCap: 5400000,
    price: 0.0028,
    volume24h: 382145,
    stakingAPY: 17.3,
    change1h: 0.2,
    change24h: -0.5,
    change7d: -1.8,
    rewardDistributed: 112345.67,
    rewardRate: 1.95,
  },
  {
    name: "VelocityVibe",
    symbol: "VVIBE",
    marketCap: 18900000,
    price: 0.052,
    volume24h: 983421,
    stakingAPY: 11.2,
    change1h: -0.1,
    change24h: 0.7,
    change7d: -2.3,
    rewardDistributed: 345678.9,
    rewardRate: 3.84,
  },
  {
    name: "StreamStonks",
    symbol: "STRNK",
    marketCap: 7200000,
    price: 0.0045,
    volume24h: 476234,
    stakingAPY: 15.4,
    change1h: 0.3,
    change24h: -0.9,
    change7d: 5.3,
    rewardDistributed: 156789.23,
    rewardRate: 2.34,
  },
  {
    name: "FlowFren",
    symbol: "FLFREN",
    marketCap: 4900000,
    price: 0.0019,
    volume24h: 293567,
    stakingAPY: 19.2,
    change1h: 0.5,
    change24h: -1.3,
    change7d: -4.8,
    rewardDistributed: 98765.43,
    rewardRate: 1.67,
  },
  {
    name: "RiverRise",
    symbol: "RVRISE",
    marketCap: 11200000,
    price: 0.0082,
    volume24h: 623478,
    stakingAPY: 14.7,
    change1h: 0.2,
    change24h: -0.7,
    change7d: -2.5,
    rewardDistributed: 223456.78,
    rewardRate: 2.89,
  },
  {
    name: "TsunamiTendies",
    symbol: "TSTEND",
    marketCap: 8900000,
    price: 0.0058,
    volume24h: 512389,
    stakingAPY: 16.1,
    change1h: 0.4,
    change24h: -1.2,
    change7d: -3.8,
    rewardDistributed: 167890.12,
    rewardRate: 2.56,
  },
  {
    name: "CurrentCoin",
    symbol: "CRCOIN",
    marketCap: 13600000,
    price: 0.0094,
    volume24h: 734521,
    stakingAPY: 13.5,
    change1h: 0.1,
    change24h: -0.3,
    change7d: 3.8,
    rewardDistributed: 289012.34,
    rewardRate: 3.12,
  },
  {
    name: "WaveWen",
    symbol: "WVWEN",
    marketCap: 6100000,
    price: 0.0031,
    volume24h: 398765,
    stakingAPY: 17.8,
    change1h: 0.2,
    change24h: -0.5,
    change7d: -1.8,
    rewardDistributed: 134567.89,
    rewardRate: 2.23,
  },
  {
    name: "StreamStack",
    symbol: "SSTACK",
    marketCap: 16400000,
    price: 0.0125,
    volume24h: 843267,
    stakingAPY: 12.9,
    change1h: 0.1,
    change24h: -0.3,
    change7d: 7.4,
    rewardDistributed: 312345.67,
    rewardRate: 3.45,
  },
  {
    name: "FlowFomo",
    symbol: "FLFOMO",
    marketCap: 5800000,
    price: 0.0026,
    volume24h: 357891,
    stakingAPY: 18.2,
    change1h: 0.3,
    change24h: -0.9,
    change7d: -3.2,
    rewardDistributed: 145678.9,
    rewardRate: 2.12,
  },
  {
    name: "RapidsRebase",
    symbol: "RPRBS",
    marketCap: 10300000,
    price: 0.0073,
    volume24h: 578234,
    stakingAPY: 15.1,
    change1h: 0.2,
    change24h: -0.7,
    change7d: -2.5,
    rewardDistributed: 189012.34,
    rewardRate: 2.67,
  },
  {
    name: "TidalChad",
    symbol: "TDCHAD",
    marketCap: 7800000,
    price: 0.0048,
    volume24h: 462789,
    stakingAPY: 16.5,
    change1h: 0.3,
    change24h: -0.9,
    change7d: -3.2,
    rewardDistributed: 156789.23,
    rewardRate: 2.34,
  },
];

export function TokenTable() {
  const [data] = useState(defaultData);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
  );
}
