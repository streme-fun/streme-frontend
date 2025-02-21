"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiConfig } from "wagmi";
import { config } from "../lib/wagmiConfig";
import { base } from "viem/chains";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          theme: "light",
        },
        supportedChains: [base],
      }}
    >
      <WagmiConfig config={config}>{children}</WagmiConfig>
    </PrivyProvider>
  );
}
