"use client";

import PrivyProviderWrapper from "../components/auth/PrivyProviderWrapper";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FrameProvider } from "../components/providers/FrameProvider";
import Provider from "../components/providers/WagmiProvider";
import { TokenDataProvider } from "../hooks/useTokenData";
import { Toaster } from "sonner";
import { useEffect } from "react";

// Global error handler for wallet provider conflicts
function WalletProviderErrorHandler() {
  useEffect(() => {
    // Handle global ethereum provider conflicts
    const handleProviderError = (event: ErrorEvent) => {
      const errorMessage = event.message || "";

      // Check for common wallet provider conflict errors
      if (
        errorMessage.includes("Cannot set property ethereum") ||
        errorMessage.includes("Cannot redefine property: ethereum") ||
        errorMessage.includes("which has only a getter")
      ) {
        console.warn(
          "Wallet provider conflict detected - this is usually harmless:",
          errorMessage
        );
        event.preventDefault(); // Prevent the error from propagating
        return true;
      }

      // Handle MetaMask provider conflicts
      if (
        errorMessage.includes(
          "MetaMask encountered an error setting the global Ethereum provider"
        )
      ) {
        console.warn(
          "MetaMask provider conflict - multiple wallets detected:",
          errorMessage
        );
        event.preventDefault();
        return true;
      }

      return false;
    };

    // Global error event listener
    window.addEventListener("error", handleProviderError);

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason || "";

      if (
        typeof reason === "string" &&
        (reason.includes("Connection interrupted while trying to subscribe") ||
          reason.includes("Failed to fetch. Refused to connect"))
      ) {
        console.warn(
          "Network connection issue (likely CSP or provider conflict):",
          reason
        );
        event.preventDefault();
        return true;
      }

      return false;
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener("error", handleProviderError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, []);

  return null; // This component doesn't render anything
}

function AppContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WalletProviderErrorHandler />
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
          <TokenDataProvider>
            <AppContent>{children}</AppContent>
          </TokenDataProvider>
        </FrameProvider>
      </Provider>
    </PrivyProviderWrapper>
  );
}
