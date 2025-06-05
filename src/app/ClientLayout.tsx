"use client";

import PrivyProviderWrapper from "../components/auth/PrivyProviderWrapper";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FrameProvider } from "../components/providers/FrameProvider";
import Provider from "../components/providers/WagmiProvider";
import { Toaster } from "sonner";

function AppContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="px-4">{children}</main>
      <Footer />
      <Toaster
        position="top-right"
        richColors
        expand={false}
        duration={4000}
        toastOptions={{
          style: {
            background: "white",
            border: "1px solid rgb(229, 231, 235)",
            color: "rgb(17, 24, 39)",
          },
        }}
      />
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
