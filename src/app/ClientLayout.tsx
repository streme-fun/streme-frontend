"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PrivyProviderWrapper from "../components/auth/PrivyProviderWrapper";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FrameProvider } from "../components/providers/FrameProvider";
import { config } from "../components/providers/WagmiProvider";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMiniAppView, setIsMiniAppView] = useState(false);

  useEffect(() => {
    setIsMiniAppView(window.parent !== window);
  }, []);

  return (
    <PrivyProviderWrapper>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <FrameProvider>
            <Navbar isMiniAppView={isMiniAppView} />
            <main className="pt-20 px-4">{children}</main>
            <Footer />
          </FrameProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProviderWrapper>
  );
}
