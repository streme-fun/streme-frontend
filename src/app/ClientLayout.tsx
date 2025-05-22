"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PrivyProviderWrapper from "../components/auth/PrivyProviderWrapper";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FrameProvider } from "../components/providers/FrameProvider";
import { config } from "../components/providers/WagmiProvider";

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
          <FrameProvider>
            <Navbar />
            <main className="px-4">{children}</main>
            <Footer />
          </FrameProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProviderWrapper>
  );
}
