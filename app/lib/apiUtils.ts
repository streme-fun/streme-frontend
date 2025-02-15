import { Token } from "@/app/types/token";
import { fetchTokensData, fetchPoolData } from "@/app/lib/geckoterminal";
import { enrichTokenWithMarketData } from "@/app/lib/mockTokens";

export type CreatorProfile = NonNullable<Token["creator"]>;

export async function fetchTokensFromStreme(): Promise<Token[]> {
  const response = await fetch("https://api.streme.fun/api/tokens", {
    cache: "no-store",
  });
  return response.json();
}

export async function fetchCreatorProfiles(
  creatorIds: string[]
): Promise<Record<string, CreatorProfile>> {
  if (creatorIds.length === 0) return {};

  const profileResponse = await fetch(
    `${
      process.env.NEXT_PUBLIC_BASE_URL
    }/api/fetchFarcasterProfile?userIds=${creatorIds.join(",")}`,
    { method: "GET" }
  );
  const profileData = await profileResponse.json();

  return (
    profileData.data?.Socials?.Social?.reduce(
      (
        acc: Record<string, CreatorProfile>,
        social: {
          userId: string;
          profileImage: string;
          profileName: string;
        }
      ) => {
        acc[social.userId] = {
          profileImage: social.profileImage,
          name: social.profileName,
          score: 0,
          recasts: 0,
          likes: 0,
        };
        return acc;
      },
      {}
    ) ?? {}
  );
}

export async function enrichTokensWithData(
  tokens: Token[],
  creatorProfiles: Record<string, CreatorProfile>
): Promise<Token[]> {
  const addresses = tokens.map((t) => t.contract_address);
  const geckoData = await fetchTokensData(addresses);

  // Fetch detailed pool data for each token
  const poolDataPromises = tokens.map((token) =>
    token.pool_address ? fetchPoolData(token.pool_address) : null
  );
  const poolData = await Promise.all(poolDataPromises);

  // Enrich tokens with all data
  return Promise.all(
    tokens.map(async (token, index) => {
      // Start with existing market data
      const enrichedToken = await enrichTokenWithMarketData(token, geckoData);

      // Add pool data if available, but don't override existing values unless null
      if (poolData[index]) {
        const pool = poolData[index];
        enrichedToken.price = enrichedToken.price ?? pool?.price;
        enrichedToken.change1h = enrichedToken.change1h ?? pool?.change1h;
        enrichedToken.change24h = enrichedToken.change24h ?? pool?.change24h;
        enrichedToken.volume24h = enrichedToken.volume24h ?? pool?.volume24h;
        enrichedToken.marketCap = enrichedToken.marketCap ?? pool?.marketCap;
      }

      // Add creator profile
      if (token.requestor_fid && creatorProfiles[token.requestor_fid]) {
        const profile = creatorProfiles[token.requestor_fid];
        enrichedToken.creator = {
          name: profile.name || "Unknown",
          score: 0,
          recasts: 0,
          likes: 0,
          profileImage: profile.profileImage,
        };
      }
      return enrichedToken;
    })
  );
}
