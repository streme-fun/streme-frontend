"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { Token } from "@/src/app/types/token";

interface TokenPageContextType {
  token: Token | null;
  isLoading: boolean;
  error: string | null;
  refreshToken: () => Promise<void>;
  setToken: React.Dispatch<React.SetStateAction<Token | null>>;
}

const TokenPageContext = createContext<TokenPageContextType | undefined>(
  undefined
);

interface TokenPageProviderProps {
  children: ReactNode;
  initialToken?: Token;
  tokenAddress: string;
}

export function TokenPageProvider({
  children,
  initialToken,
  tokenAddress,
}: TokenPageProviderProps) {
  const [token, setToken] = useState<Token | null>(initialToken || null);
  const [isLoading, setIsLoading] = useState(!initialToken);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch GeckoTerminal market data
  const fetchGeckoTerminalData = async (poolAddress: string) => {
    try {
      const response = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}?include=base_token%2Cquote_token`
      );

      if (!response.ok) {
        console.warn(`GeckoTerminal API returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      const poolData = data?.data;

      if (poolData) {
        return {
          price: parseFloat(poolData.attributes?.base_token_price_usd || "0"),
          change1h: parseFloat(
            poolData.attributes?.price_change_percentage?.h1 || "0"
          ),
          change24h: parseFloat(
            poolData.attributes?.price_change_percentage?.h24 || "0"
          ),
          volume24h: parseFloat(poolData.attributes?.volume_usd?.h24 || "0"),
          marketCap: parseFloat(poolData.attributes?.market_cap_usd || "0"),
        };
      }
    } catch (error) {
      console.warn("Error fetching GeckoTerminal data:", error);
    }
    return null;
  };

  // Centralized token fetching with intelligent change detection
  const fetchToken = useCallback(
    async (force = false) => {
      if (!tokenAddress) return;

      // Don't show loading for background refreshes
      if (force || !token) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(
          `/api/tokens/single?address=${tokenAddress}&type=all`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.data) {
          const baseToken = data.data;

          // Only update if this is the same token we're expecting
          if (
            baseToken.contract_address?.toLowerCase() !==
            tokenAddress?.toLowerCase()
          ) {
            console.warn(
              "TokenPageProvider: Received data for different token",
              {
                expected: tokenAddress,
                received: baseToken.contract_address,
              }
            );
            return;
          }

          // Check if token data has meaningfully changed
          const hasChanged =
            !token ||
            baseToken.staking_pool !== token.staking_pool ||
            baseToken.staking_address !== token.staking_address ||
            Math.abs((baseToken.price || 0) - (token.price || 0)) >
              (token.price || 0) * 0.01; // 1% price change threshold

          if (hasChanged || force) {
            // Fetch enhanced market data from GeckoTerminal if available
            let enhancedToken = { ...baseToken };

            if (baseToken.pool_address) {
              const geckoData = await fetchGeckoTerminalData(
                baseToken.pool_address
              );
              if (geckoData) {
                enhancedToken = {
                  ...baseToken,
                  price: geckoData.price ?? baseToken.price,
                  change1h: geckoData.change1h ?? baseToken.change1h,
                  change24h: geckoData.change24h ?? baseToken.change24h,
                  volume24h: geckoData.volume24h ?? baseToken.volume24h,
                  marketCap: geckoData.marketCap ?? baseToken.marketCap,
                };
              }
            }

            setToken(enhancedToken);

            if (hasChanged && token) {
              console.log("TokenPageProvider: Token data changed, updating:", {
                old: {
                  staking_pool: token.staking_pool,
                  staking_address: token.staking_address,
                  price: token.price,
                },
                new: {
                  staking_pool: enhancedToken.staking_pool,
                  staking_address: enhancedToken.staking_address,
                  price: enhancedToken.price,
                },
              });
            }
          } else {
            console.log(
              "TokenPageProvider: Token data unchanged, skipping update"
            );
          }
        } else {
          throw new Error("No token data found");
        }
      } catch (err) {
        console.error("TokenPageProvider: Error fetching token:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch token data"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [tokenAddress, token]
  );

  // Use ref to avoid recreating intervals when fetchToken changes
  const fetchTokenRef = useRef(fetchToken);
  fetchTokenRef.current = fetchToken;

  // Initial fetch effect - only runs when tokenAddress changes or when we have no token
  useEffect(() => {
    if (!tokenAddress) return;

    // Only do initial fetch if we don't have token data
    if (!token) {
      fetchTokenRef.current();
    }
  }, [tokenAddress, token]);

  // Polling effect - only runs once when tokenAddress changes
  useEffect(() => {
    if (!tokenAddress) return;

    console.log(`[TokenPageContext] Setting up polling for ${tokenAddress}`);

    // Set up intelligent polling:
    // - More frequent for first 5 minutes (30s intervals)
    // - Then less frequent (5 minute intervals)
    let longInterval: NodeJS.Timeout;

    // Short interval for first 5 minutes
    const shortInterval = setInterval(() => {
      console.log(
        `[TokenPageContext] Short interval fetch for ${tokenAddress}`
      );
      fetchTokenRef.current(false);
    }, 30000); // 30 seconds

    // Switch to longer interval after 5 minutes
    const switchTimeout = setTimeout(() => {
      console.log(
        `[TokenPageContext] Switching to long interval for ${tokenAddress}`
      );
      clearInterval(shortInterval);
      longInterval = setInterval(() => {
        console.log(
          `[TokenPageContext] Long interval fetch for ${tokenAddress}`
        );
        fetchTokenRef.current(false);
      }, 300000); // 5 minutes
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      console.log(`[TokenPageContext] Cleaning up polling for ${tokenAddress}`);
      clearTimeout(switchTimeout);
      if (shortInterval) clearInterval(shortInterval);
      if (longInterval) clearInterval(longInterval);
    };
  }, [tokenAddress]); // Only depend on tokenAddress, not token

  const refreshToken = useCallback(() => fetchToken(true), [fetchToken]);

  const value: TokenPageContextType = {
    token,
    isLoading,
    error,
    refreshToken,
    setToken,
  };

  return (
    <TokenPageContext.Provider value={value}>
      {children}
    </TokenPageContext.Provider>
  );
}

export function useTokenPageContext(): TokenPageContextType {
  const context = useContext(TokenPageContext);
  if (context === undefined) {
    throw new Error(
      "useTokenPageContext must be used within a TokenPageProvider"
    );
  }
  return context;
}

// Hook for components that need to know when token data changes
export function useTokenData() {
  const { token, isLoading, error, refreshToken } = useTokenPageContext();
  return { token, isLoading, error, refreshToken };
}
