import { Token } from "@/app/types/token";

interface GeckoData {
  price?: number;
  marketCap?: number;
  volume24h?: number;
  total_reserve_in_usd?: number;
}

// Helper function to create a token with common fields
export async function enrichTokenWithMarketData(
  token: Token | null,
  geckoData: Record<string, GeckoData>
): Promise<Token> {
  if (!token || !token.contract_address) {
    console.error("Invalid token data:", token);
    return token as Token;
  }

  const tokenData = geckoData[token.contract_address.toLowerCase()];
  const enrichedToken = { ...token };

  if (tokenData) {
    // Use real market data if available
    enrichedToken.price = tokenData.price;
    enrichedToken.marketCap = tokenData.marketCap;
    enrichedToken.volume24h = tokenData.volume24h;

    // Calculate market cap change (you might want to store historical data to calculate properly)
    enrichedToken.marketCapChange = 0; // This needs historical data to calculate properly
  }

  // Keep the existing staking and rewards data if they exist
  if (enrichedToken.stakingAPY !== undefined) {
    enrichedToken.stakingAPY = enrichedToken.stakingAPY;
  }
  if (enrichedToken.rewardDistributed !== undefined) {
    enrichedToken.rewardDistributed = enrichedToken.rewardDistributed;
  }
  if (enrichedToken.rewardRate !== undefined) {
    enrichedToken.rewardRate = enrichedToken.rewardRate;
  }

  return enrichedToken;
}
