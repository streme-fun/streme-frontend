"use client";

import { useState, useEffect } from "react";

export function TotalRewards({
  initialTotal,
  ratePerSecond,
}: {
  initialTotal: number;
  ratePerSecond: number;
}) {
  const [value, setValue] = useState(initialTotal);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue((prev) => prev + ratePerSecond / 20);
    }, 50);

    return () => clearInterval(interval);
  }, [ratePerSecond]);

  return (
    <div className="flex flex-col items-center gap-2 mb-4">
      <div className="text-sm ">Total Staking Rewards Distributed</div>
      <div className="font-mono text-2xl sm:text-6xl font-bold">
        $
        {value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}
