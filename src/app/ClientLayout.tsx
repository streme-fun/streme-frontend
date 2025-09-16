"use client";

import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { MiniAppTopNavbar } from "../components/MiniAppTopNavbar";
import { MiniAppBottomNavbar } from "../components/MiniAppBottomNavbar";
import { MiniAppTutorialModal } from "../components/MiniAppTutorialModal";
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
// import { UnstakedTokensModal } from "../components/UnstakedTokensModal";
import { formatUnits } from "viem";
import { publicClient } from "../lib/viemClient";

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

// Blacklisted token addresses to filter out
const BLACKLISTED_TOKENS = [
  "0x1efF3Dd78F4A14aBfa9Fa66579bD3Ce9E1B30529",
  "0xe58267cd7299c29a1b77F4E66Cd12Dd24a2Cd2FD",
  "0x8414Ab8C70c7b16a46012d49b8111959Baf2fC42",
  "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93",
  "0x304989dA2AdC80a6568170567D477Af5E48DBaAe",
  "0xDFd428908909CB5E24F5e79E6aD6BDE10bdf2327",
  "0x58122a048878F25C8C5d4b562419500ED74C6f75",
  "0x4E395eC7b71Dd87A23dD836edb3eFE15A6c2002B",
  "0x09b1AD979d093377e201d804Fa9aC0a9a07cfB0b",
  "0xefbE11336b0008dCE3797C515E6457cC4841645c",
  "0x5f2Fab273F1F64b6bc6ab8F35314CD21501F35C5",
  "0x9097E4A4D75A611b65aB21d98A7D5b1177C050F7",
  "0x1BA8603DA702602A8657980e825A6DAa03Dee93a",
  "0xfe2224bd9c4aFf648F93B036172444C533DbF116",
  "0xd04383398dd2426297da660f9cca3d439af9ce1b",
].map((addr) => addr?.toLowerCase() || "");

interface UnstakedToken {
  tokenAddress: string;
  symbol: string;
  balance: number;
  stakingAddress?: string;
  logo?: string;
  marketData?: {
    marketCap: number;
    price: number;
    priceChange24h: number;
  };
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
    address: fcAddress,
    isConnected: fcIsConnected,
    isSDKLoaded: isDetectionComplete,
    farcasterContext,
  } = useAppFrameLogic();

  // const [unstakedTokens, setUnstakedTokens] = useState<UnstakedToken[]>([]);
  const [mounted, setMounted] = useState(false);
  const [stableConnectionState, setStableConnectionState] = useState<{
    isStable: boolean;
    address: string | undefined;
    isConnected: boolean;
  }>({ isStable: false, address: undefined, isConnected: false });
  
  // Profile picture and user data state for mini-app
  const [miniAppProfileImage, setMiniAppProfileImage] = useState<string>("");
  const [miniAppUserData, setMiniAppUserData] = useState<{
    displayName: string;
    username: string;
    profileImage: string;
  } | null>(null);
  
  // Tutorial modal state for mini-app
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // Get effective address based on context
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;
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

    setMounted(true);
  }, []);

  // Debounce connection state to prevent rapid changes causing timing issues
  useEffect(() => {
    // Only start debouncing after detection is complete and component is mounted
    if (!isDetectionComplete || !mounted) {
      return;
    }

    const debounceTimeout = setTimeout(() => {
      const currentAddress = effectiveAddress;
      const currentIsConnected = effectiveIsConnected;

      // Additional validation for mini app context
      if (isMiniAppView) {
        // For mini app, ensure we have a valid Ethereum address format
        if (
          !currentAddress ||
          !currentAddress.startsWith("0x") ||
          currentAddress.length !== 42
        ) {
          console.log("Mini app: Invalid address format, waiting...", {
            currentAddress,
          });
          return;
        }
      }

      // Only update if the state has actually changed or is being set for the first time
      if (
        !stableConnectionState.isStable ||
        stableConnectionState.address !== currentAddress ||
        stableConnectionState.isConnected !== currentIsConnected
      ) {
        console.log("Updating stable connection state:", {
          isMiniAppView,
          currentAddress,
          currentIsConnected,
          timestamp: new Date().toISOString(),
        });

        setStableConnectionState({
          isStable: true,
          address: currentAddress,
          isConnected: currentIsConnected,
        });
      }
    }, 750); // 750ms debounce to allow for state settling

    return () => clearTimeout(debounceTimeout);
  }, [
    effectiveAddress,
    effectiveIsConnected,
    isDetectionComplete,
    mounted,
    isMiniAppView,
    stableConnectionState,
  ]);

  // Helper function to safely call toLowerCase on potentially null values
  const safeToLowerCase = React.useCallback(
    (value: string | null | undefined): string => {
      if (!value || typeof value !== "string") {
        return "";
      }
      return value.toLowerCase();
    },
    []
  );

  // Helper function to fetch token data
  const fetchTokenData = React.useCallback(
    async (tokenAddress: string) => {
      if (
        !tokenAddress ||
        BLACKLISTED_TOKENS.includes(safeToLowerCase(tokenAddress))
      ) {
        return {
          staking_address: undefined,
          logo: undefined,
          marketData: undefined,
        };
      }

      try {
        const response = await fetch(
          `/api/tokens/single?address=${tokenAddress}`
        );
        if (response.ok) {
          const result = await response.json();
          return {
            staking_address: result.data?.staking_address,
            logo:
              result.data?.img_url || result.data?.logo || result.data?.image,
            marketData: result.data?.marketData,
          };
        }
      } catch (error) {
        console.warn("Could not fetch token data for:", tokenAddress, error);
      }

      return {
        staking_address: undefined,
        logo: undefined,
        marketData: undefined,
      };
    },
    [safeToLowerCase]
  );

  // Check for unstaked tokens when stable connection is established
  useEffect(() => {
    const checkForUnstakedTokens = async () => {
      // Wait for stable connection state
      if (
        !stableConnectionState.isStable ||
        !stableConnectionState.address ||
        !stableConnectionState.isConnected
      ) {
        // Only log once when first waiting, not repeatedly
        if (stableConnectionState.isStable === false) {
          console.log("Waiting for stable connection state...", {
            isStable: stableConnectionState.isStable,
            hasAddress: !!stableConnectionState.address,
            isConnected: stableConnectionState.isConnected,
          });
        }
        return;
      }

      // Check if user has dismissed the modal in this session
      const hasSeenModal = sessionStorage.getItem(
        "unstakedTokensModalDismissed"
      );
      if (hasSeenModal === "true") {
        console.log("Modal already dismissed this session");
        return;
      }

      console.log("Starting unstaked tokens check with stable state:", {
        address: stableConnectionState.address,
        isConnected: stableConnectionState.isConnected,
        isMiniAppView,
        timestamp: new Date().toISOString(),
      });

      try {
        const accountId = safeToLowerCase(stableConnectionState.address);

        const query = `
          query GetAccountTokens($accountId: ID!) {
            account(id: $accountId) {
              accountTokenSnapshots {
                token {
                  id
                  symbol
                  isNativeAssetSuperToken
                }
                balanceUntilUpdatedAt
              }
              poolMemberships {
                units
                pool {
                  token {
                    id
                  }
                }
              }
            }
          }
        `;

        const endpoints = [
          "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
          "https://api.thegraph.com/subgraphs/name/superfluid-finance/protocol-v1-base",
        ];

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query,
                variables: { accountId },
              }),
            });

            if (!response.ok) continue;

            const data = await response.json();
            if (data.errors) continue;

            const accountData = data.data?.account;
            if (accountData?.accountTokenSnapshots) {
              // Get tokens that have been staked (have pool memberships with units > 0)
              const stakedTokens = new Set(
                (accountData.poolMemberships || [])
                  .filter(
                    (membership: {
                      units?: string;
                      pool?: { token?: { id?: string } };
                    }) =>
                      membership.units &&
                      parseFloat(membership.units) > 0 &&
                      membership.pool?.token?.id
                  )
                  .map((membership: { pool: { token: { id: string } } }) =>
                    safeToLowerCase(membership.pool.token.id)
                  )
              );

              // Filter to only tokens that have NEVER been staked
              const validSnapshots = accountData.accountTokenSnapshots.filter(
                (snapshot: {
                  balanceUntilUpdatedAt?: string;
                  token: {
                    isNativeAssetSuperToken?: boolean;
                    id?: string;
                    symbol?: string;
                  };
                }) =>
                  snapshot.balanceUntilUpdatedAt &&
                  parseFloat(snapshot.balanceUntilUpdatedAt) > 0 &&
                  !snapshot.token.isNativeAssetSuperToken &&
                  snapshot.token.id &&
                  !BLACKLISTED_TOKENS.includes(
                    safeToLowerCase(snapshot.token.id)
                  ) &&
                  !stakedTokens.has(safeToLowerCase(snapshot.token.id)) // Only never-staked tokens
              );

              if (validSnapshots.length > 0) {
                // Fetch current balances and token data
                const tokenAddresses = validSnapshots.map(
                  (snapshot: { token: { id: string } }) => snapshot.token.id
                );

                const balancePromises = tokenAddresses.map(
                  async (tokenAddress: string) => {
                    try {
                      const balance = await publicClient.readContract({
                        address: tokenAddress as `0x${string}`,
                        abi: [
                          {
                            inputs: [{ name: "account", type: "address" }],
                            name: "balanceOf",
                            outputs: [{ name: "", type: "uint256" }],
                            stateMutability: "view",
                            type: "function",
                          },
                        ],
                        functionName: "balanceOf",
                        args: [stableConnectionState.address as `0x${string}`],
                      });
                      return { tokenAddress, balance };
                    } catch {
                      return { tokenAddress, balance: BigInt(0) };
                    }
                  }
                );

                const balanceResults = await Promise.all(balancePromises);
                const balanceMap = new Map(
                  balanceResults.map((result) => [
                    result.tokenAddress,
                    result.balance,
                  ])
                );

                // Fetch token data in parallel
                const tokenDataPromises = tokenAddresses
                  .slice(0, 5)
                  .map((tokenAddress: string) => fetchTokenData(tokenAddress));
                const tokenDataResults = await Promise.all(tokenDataPromises);

                const tokens: UnstakedToken[] = [];

                for (let i = 0; i < Math.min(validSnapshots.length, 5); i++) {
                  const snapshot = validSnapshots[i];
                  const tokenAddress = snapshot.token.id;
                  const currentBalance =
                    balanceMap.get(tokenAddress) || BigInt(0);
                  const formattedBalance = Number(
                    formatUnits(currentBalance, 18)
                  );
                  const tokenData = tokenDataResults[i];

                  if (formattedBalance > 0 && tokenData.staking_address) {
                    tokens.push({
                      tokenAddress,
                      symbol: snapshot.token.symbol,
                      balance: formattedBalance,
                      stakingAddress: tokenData.staking_address,
                      logo: tokenData.logo,
                      marketData: tokenData.marketData,
                    });
                  }
                }

                // setUnstakedTokens(tokens);
              }
            }
            break;
          } catch (error) {
            console.warn(`Failed to fetch from ${endpoint}:`, error);
            continue;
          }
        }
      } catch (error) {
        console.error("Error checking for unstaked tokens:", error);
      }
    };

    // Run immediately when stable connection is available
    checkForUnstakedTokens();
  }, [stableConnectionState, isMiniAppView, safeToLowerCase, fetchTokenData]);

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

  // Tutorial handlers for mini-app
  const handleTutorialClick = () => {
    setShowTutorialModal(true);
  };

  const handleCloseTutorial = () => {
    setShowTutorialModal(false);
    // Save completion state so user doesn't see tutorial again
    if (typeof window !== "undefined") {
      localStorage.setItem("streme-tutorial-skipped", "true");
    }
  };

  const handleSkipTutorial = () => {
    setShowTutorialModal(false);
    // Save to localStorage so user doesn't see tutorial again
    if (typeof window !== "undefined") {
      localStorage.setItem("streme-tutorial-skipped", "true");
    }
  };

  return (
    <>
      <WalletProviderErrorHandler />
      {isMiniAppView ? (
        <>
          {isHomePage && (
            <MiniAppTopNavbar 
              isConnected={effectiveIsConnected}
              onLogoClick={() => {}} 
              onTutorialClick={handleTutorialClick}
            />
          )}
          <main className={`px-4 ${isHomePage ? "pt-16 pb-20" : "pb-20"}`}>{children}</main>
          <MiniAppBottomNavbar 
            profileImage={miniAppProfileImage}
            userData={miniAppUserData}
          />
          <MiniAppTutorialModal
            isOpen={showTutorialModal}
            onClose={handleCloseTutorial}
            onSkip={handleSkipTutorial}
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

      {/* Global Unstaked Tokens Modal */}
      {/* {mounted && unstakedTokens.length > 0 && (
        <UnstakedTokensModal
          unstakedTokens={unstakedTokens}
          onDismiss={() => {
            // Store dismissal in sessionStorage to match UnstakedTokensModal
            sessionStorage.setItem("unstakedTokensModalDismissed", "true");
            setUnstakedTokens([]);
          }}
        />
      )} */}
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
