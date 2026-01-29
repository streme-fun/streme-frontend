"use client";

import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { MiniAppTopNavbar } from "../components/MiniAppTopNavbar";
import { MiniAppBottomNavbar } from "../components/MiniAppBottomNavbar";
import { usePathname } from "next/navigation";
import { FrameProvider } from "../components/providers/FrameProvider";
import MiniAppWagmiProvider from "../components/providers/MiniAppWagmiProvider";
import BrowserWagmiProvider from "../components/providers/BrowserWagmiProvider";
import { TokenDataProvider } from "../hooks/useTokenData";
import { Toaster } from "sonner";
import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { detectEnvironmentForProviders } from "../lib/miniAppDetection";
import { EnvironmentProvider } from "../components/providers/EnvironmentProvider";

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

// Client-side function to fetch user data from our API
const fetchNeynarUser = async (fid: number) => {
  try {
    const response = await fetch(`/api/neynar/user/${fid}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching user from API:", error);
    return null;
  }
};

function AppContent({ children }: { children: React.ReactNode }) {
  const { address: wagmiAddress } = useAccount();
  const {
    isMiniAppView,
    isConnected: fcIsConnected,
    farcasterContext,
  } = useAppFrameLogic();

  // Profile picture and user data state for mini-app
  const [miniAppProfileImage, setMiniAppProfileImage] = useState<string>("");
  const [miniAppUserData, setMiniAppUserData] = useState<{
    displayName: string;
    username: string;
    profileImage: string;
  } | null>(null);

  // Get effective connection status based on context
  const effectiveIsConnected = isMiniAppView ? fcIsConnected : !!wagmiAddress;

  // Initialize theme-change early to prevent timing issues
  useEffect(() => {
    // Import and initialize theme-change as soon as component mounts
    import("theme-change").then(({ themeChange }) => {
      themeChange(false);
      // Ensure theme is properly applied
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    });

    // Initialize Eruda for debugging in development or when debug=true query param
    const shouldLoadEruda =
      process.env.NODE_ENV === "development" ||
      (typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("debug") === "true");

    if (shouldLoadEruda && typeof window !== "undefined") {
      import("eruda")
        .then((eruda) => {
          eruda.default.init();
          console.log("🐛 Eruda debugging console initialized");
        })
        .catch((error) => {
          console.warn("Failed to load Eruda:", error);
        });
    }
  }, []);

  // Fetch profile picture and user data for mini-app view
  useEffect(() => {
    const fetchMiniAppProfile = async () => {
      if (!isMiniAppView || !farcasterContext?.user?.fid) {
        setMiniAppProfileImage("");
        setMiniAppUserData(null);
        return;
      }

      try {
        const neynarUser = await fetchNeynarUser(farcasterContext.user.fid);
        if (neynarUser) {
          const profileImage = neynarUser.pfp_url || "";
          const displayName =
            neynarUser.display_name || neynarUser.username || "Anonymous User";
          const username = neynarUser.username || "";

          setMiniAppProfileImage(profileImage);
          setMiniAppUserData({
            displayName,
            username,
            profileImage,
          });
        }
      } catch (error) {
        console.error("Error fetching mini-app profile:", error);
        setMiniAppProfileImage("");
        setMiniAppUserData(null);
      }
    };

    fetchMiniAppProfile();
  }, [isMiniAppView, farcasterContext?.user?.fid]);

  // Check if we're on the home page for conditional top navbar rendering
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <>
      <WalletProviderErrorHandler />
      {isMiniAppView ? (
        <>
          {isHomePage && (
            <MiniAppTopNavbar
              isConnected={effectiveIsConnected}
              onLogoClick={() => {}}
              onTutorialClick={() => {}}
            />
          )}
          <main className={`px-4 ${isHomePage ? "pt-16 pb-20" : "pb-20"}`}>{children}</main>
          <MiniAppBottomNavbar
            profileImage={miniAppProfileImage}
            userData={miniAppUserData}
          />
        </>
      ) : (
        <>
          <Navbar />
          <main className="px-4">{children}</main>
          <Footer />
        </>
      )}
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

// Mini-app specific layout (no RainbowKit)
function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EnvironmentProvider isMiniApp={true}>
      <FrameProvider>
        <MiniAppWagmiProvider>
          <TokenDataProvider>
            <AppContent>{children}</AppContent>
          </TokenDataProvider>
        </MiniAppWagmiProvider>
      </FrameProvider>
    </EnvironmentProvider>
  );
}

// Browser layout (RainbowKit + wagmi)
function BrowserLayout({ children }: { children: React.ReactNode }) {
  return (
    <EnvironmentProvider isMiniApp={false}>
      <FrameProvider>
        <BrowserWagmiProvider>
          <TokenDataProvider>
            <AppContent>{children}</AppContent>
          </TokenDataProvider>
        </BrowserWagmiProvider>
      </FrameProvider>
    </EnvironmentProvider>
  );
}

// Environment detection component
function EnvironmentDetector({ children }: { children: React.ReactNode }) {
  const [isMiniApp, setIsMiniApp] = useState<boolean | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    const detectEnvironment = async () => {
      const startTime = Date.now();
      try {
        console.log("🔍 EnvironmentDetector: Starting detection...");

        // For Coinbase Wallet, ethereum provider might not be immediately available
        // Wait a bit if we're in an iframe context
        if (typeof window !== "undefined" && window.parent !== window) {
          console.log(
            "🔍 EnvironmentDetector: Iframe detected, waiting for ethereum provider..."
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Try detection with retries for SDK context
        let isMiniApp = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          console.log(
            `🔍 EnvironmentDetector: Detection attempt ${
              attempts + 1
            }/${maxAttempts}`
          );

          const detectionPromise = detectEnvironmentForProviders();
          const result = await Promise.race([
            detectionPromise,
            new Promise<boolean>((resolve) =>
              setTimeout(() => resolve(false), 1500)
            ),
          ]);

          // If we detected as mini-app, we're done
          if (result === true) {
            isMiniApp = true;
            break;
          }

          // If not detected as mini-app, wait a bit and try again (SDK might not be ready)
          if (attempts < maxAttempts - 1) {
            console.log(
              `🔍 EnvironmentDetector: Not detected as mini-app, waiting before retry...`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          attempts++;
        }

        console.log("🔍 EnvironmentDetector: Detection result:", isMiniApp);
        console.log(
          "🔍 EnvironmentDetector: Detection took",
          Date.now() - startTime,
          "ms"
        );
        setIsMiniApp(isMiniApp);
      } catch (error) {
        console.error("EnvironmentDetector: Detection error:", error);
        // Default to browser mode on error
        setIsMiniApp(false);
      } finally {
        setIsDetecting(false);
      }
    };

    detectEnvironment();
  }, []);

  // Show loading during detection
  if (isDetecting || isMiniApp === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <img
          src="/icon-transparent.png"
          alt="Loading"
          className="w-16 h-16 animate-pulse"
        />
      </div>
    );
  }

  // Render appropriate layout
  return isMiniApp ? (
    <MiniAppLayout>{children}</MiniAppLayout>
  ) : (
    <BrowserLayout>{children}</BrowserLayout>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EnvironmentDetector>{children}</EnvironmentDetector>;
}
