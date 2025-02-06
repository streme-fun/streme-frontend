"use client";

import TokenSwap from "@/app/components/TokenSwap";

export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center ">
      <TokenSwap token="usdc" />
    </div>
  );
}
