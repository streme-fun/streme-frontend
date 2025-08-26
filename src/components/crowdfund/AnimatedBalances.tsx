"use client";

import { memo } from "react";

export const AnimatedBalance = memo(
  ({
    amount,
    symbol,
    subtitle,
  }: {
    amount: number;
    symbol: string;
    subtitle: string;
  }) => {
    return (
      <div className="mt-1 mb-1">
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-primary">
            {amount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {symbol}
          </div>
          <div className="text-xs text-base-content/60">{subtitle}</div>
        </div>
      </div>
    );
  }
);

AnimatedBalance.displayName = "AnimatedBalance";

export const AnimatedBalanceWithUSD = memo(
  ({
    amount,
    symbol,
    usdValue,
    price,
    subtitle,
  }: {
    amount: number;
    symbol: string;
    usdValue: number;
    price: number | null;
    subtitle: string;
  }) => {
    return (
      <div className="mt-2 mb-1">
        <div className="text-center">
          <div className="text-3xl font-bold font-mono text-primary">
            {amount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {symbol}
          </div>
          <div className="text-lg font-bold text-success mt-1">
            {price
              ? `($${usdValue.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} USD)`
              : "Loading price..."}
          </div>
          <div className="text-xs text-base-content/60 mt-1">{subtitle}</div>
        </div>
      </div>
    );
  }
);

AnimatedBalanceWithUSD.displayName = "AnimatedBalanceWithUSD";