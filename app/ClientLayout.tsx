"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PrivyProviderWrapper from "./components/auth/PrivyProviderWrapper";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyProviderWrapper>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <Navbar />
          <main className="pt-20 px-4">{children}</main>
          <Footer />
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProviderWrapper>
  );
}
