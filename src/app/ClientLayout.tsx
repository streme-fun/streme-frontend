"use client";

import PrivyProviderWrapper from "../components/auth/PrivyProviderWrapper";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FrameProvider } from "../components/providers/FrameProvider";
import Provider from "../components/providers/WagmiProvider";

function AppContent({ children }: { children: React.ReactNode }) {
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
      <Provider>
        <FrameProvider>
          <AppContent>{children}</AppContent>
        </FrameProvider>
      </Provider>
    </PrivyProviderWrapper>
  );
}
