"use client";

import dynamic from "next/dynamic";

const WagmiProvider = dynamic(
  () => import("@/app/components/providers/WagmiProvider"),
  {
    ssr: false,
  }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return <WagmiProvider>{children}</WagmiProvider>;
}
