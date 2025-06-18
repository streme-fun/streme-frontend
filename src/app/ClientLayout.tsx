"use client";

import PrivyProviderWrapper from "../components/auth/PrivyProviderWrapper";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { FrameProvider } from "../components/providers/FrameProvider";
import Provider from "../components/providers/WagmiProvider";
import { TokenDataProvider } from "../hooks/useTokenData";
import { Toaster } from "sonner";
import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { UnstakedTokensModal } from "../components/UnstakedTokensModal";
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

function AppContent({ children }: { children: React.ReactNode }) {
  const { address: wagmiAddress } = useAccount();
  const {
    isMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
  } = useAppFrameLogic();
  
  const [unstakedTokens, setUnstakedTokens] = useState<UnstakedToken[]>([]);
  const [mounted, setMounted] = useState(false);

  // Get effective address based on context
  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;
  const effectiveIsConnected = isMiniAppView ? fcIsConnected : !!wagmiAddress;

  // Initialize theme-change early to prevent timing issues
  useEffect(() => {
    // Import and initialize theme-change as soon as component mounts
    import('theme-change').then(({ themeChange }) => {
      themeChange(false);
      // Ensure theme is properly applied
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    });
    setMounted(true);
  }, []);

  // Helper function to safely call toLowerCase on potentially null values
  const safeToLowerCase = React.useCallback((value: string | null | undefined): string => {
    if (!value || typeof value !== "string") {
      return "";
    }
    return value.toLowerCase();
  }, []);

  // Helper function to fetch token data
  const fetchTokenData = React.useCallback(async (tokenAddress: string) => {
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
          logo: result.data?.img_url || result.data?.logo || result.data?.image,
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
  }, [safeToLowerCase]);

  // Check for unstaked tokens when user connects
  useEffect(() => {
    const checkForUnstakedTokens = async () => {
      console.log("Checking for unstaked tokens...", {
        effectiveAddress,
        effectiveIsConnected,
        mounted,
        hasSeenModal: sessionStorage.getItem("unstakedTokensModalDismissed")
      });

      if (!effectiveAddress || !effectiveIsConnected || !mounted) return;

      // Check if user has dismissed the modal in this session
      const hasSeenModal = sessionStorage.getItem("unstakedTokensModalDismissed");
      if (hasSeenModal === "true") {
        console.log("Modal was already dismissed in this session");
        return;
      }

      try {
        const accountId = safeToLowerCase(effectiveAddress);

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
                  .filter((membership: { units?: string; pool?: { token?: { id?: string } } }) => 
                    membership.units && 
                    parseFloat(membership.units) > 0 &&
                    membership.pool?.token?.id
                  )
                  .map((membership: { pool: { token: { id: string } } }) => safeToLowerCase(membership.pool.token.id))
              );

              // Filter to only tokens that have NEVER been staked
              const validSnapshots = accountData.accountTokenSnapshots.filter(
                (snapshot: { 
                  balanceUntilUpdatedAt?: string; 
                  token: { 
                    isNativeAssetSuperToken?: boolean; 
                    id?: string; 
                    symbol?: string;
                  } 
                }) =>
                  snapshot.balanceUntilUpdatedAt &&
                  parseFloat(snapshot.balanceUntilUpdatedAt) > 0 &&
                  !snapshot.token.isNativeAssetSuperToken &&
                  snapshot.token.id &&
                  !BLACKLISTED_TOKENS.includes(safeToLowerCase(snapshot.token.id)) &&
                  !stakedTokens.has(safeToLowerCase(snapshot.token.id)) // Only never-staked tokens
              );

              if (validSnapshots.length > 0) {
                // Fetch current balances and token data
                const tokenAddresses = validSnapshots.map((snapshot: { token: { id: string } }) => snapshot.token.id);
                
                const balancePromises = tokenAddresses.map(async (tokenAddress: string) => {
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
                      args: [effectiveAddress as `0x${string}`],
                    });
                    return { tokenAddress, balance };
                  } catch {
                    return { tokenAddress, balance: BigInt(0) };
                  }
                });

                const balanceResults = await Promise.all(balancePromises);
                const balanceMap = new Map(
                  balanceResults.map((result) => [result.tokenAddress, result.balance])
                );

                // Fetch token data in parallel
                const tokenDataPromises = tokenAddresses.slice(0, 5).map((tokenAddress: string) =>
                  fetchTokenData(tokenAddress)
                );
                const tokenDataResults = await Promise.all(tokenDataPromises);

                const tokens: UnstakedToken[] = [];
                
                for (let i = 0; i < Math.min(validSnapshots.length, 5); i++) {
                  const snapshot = validSnapshots[i];
                  const tokenAddress = snapshot.token.id;
                  const currentBalance = balanceMap.get(tokenAddress) || BigInt(0);
                  const formattedBalance = Number(formatUnits(currentBalance, 18));
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

                console.log("Found unstaked tokens:", tokens);
                setUnstakedTokens(tokens);
              } else {
                console.log("No valid token snapshots found");
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

    // Small delay to ensure wallet connection is fully established
    const timeoutId = setTimeout(checkForUnstakedTokens, 500);
    return () => clearTimeout(timeoutId);
  }, [effectiveAddress, effectiveIsConnected, mounted, fetchTokenData]);

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
      
      {/* Global Unstaked Tokens Modal */}
      {mounted && unstakedTokens.length > 0 && (
        <UnstakedTokensModal
          unstakedTokens={unstakedTokens}
          onDismiss={() => {
            // Store dismissal in sessionStorage to match UnstakedTokensModal
            sessionStorage.setItem("unstakedTokensModalDismissed", "true");
            setUnstakedTokens([]);
          }}
        />
      )}
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
