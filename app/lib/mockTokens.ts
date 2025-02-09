import { Token } from "@/app/types/token";

// Helper function to create a token with common fields
export async function enrichTokenWithMarketData(
  token: Token,
  geckoData: Record<
    string,
    {
      price: number;
      marketCap: number;
      volume24h: number;
      total_reserve_in_usd: number;
    }
  >
): Promise<Token> {
  const tokenData = geckoData[token.contract_address.toLowerCase()];
  const enrichedToken = { ...token };

  if (tokenData) {
    // Use real market data if available
    enrichedToken.price = tokenData.price;
    enrichedToken.marketCap = tokenData.marketCap;
    enrichedToken.volume24h = tokenData.volume24h;

    // Calculate market cap change (you might want to store historical data to calculate this properly)
    enrichedToken.marketCapChange = 0; // This needs historical data to calculate properly
  } else {
    // Fallback to mock data if GeckoTerminal data is unavailable
    enrichedToken.price = 0.0001;
    enrichedToken.marketCap = 459510;
    enrichedToken.marketCapChange = 12.77;
    enrichedToken.volume24h = 12420;
  }

  // Keep the existing staking and rewards data
  enrichedToken.stakingAPY = 156.8;
  enrichedToken.rewardDistributed = 123456.78;
  enrichedToken.rewardRate = 1.85;

  return enrichedToken;
}
