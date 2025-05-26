"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "@privy-io/wagmi";
import PrivyProviderWrapper from "../components/auth/PrivyProviderWrapper";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FrameProvider } from "../components/providers/FrameProvider";
import { config } from "../components/providers/WagmiProvider";
import { useWalletSync } from "../hooks/useWalletSync";

const queryClient = new QueryClient();

function AppContent({ children }: { children: React.ReactNode }) {
  // Enable automatic wallet switching when users change accounts in browser extension
  useWalletSync();

  return (
    <>
      <Navbar />
      <main className="px-4">{children}</main>
      <Footer />
    </>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyProviderWrapper>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <FrameProvider>
            <AppContent>{children}</AppContent>
          </FrameProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProviderWrapper>
  );
}
