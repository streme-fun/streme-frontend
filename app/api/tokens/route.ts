import { Token } from "@/app/types/token";
import { enrichTokenWithMarketData } from "@/app/lib/mockTokens";
import { fetchTokensData, fetchPoolData } from "@/app/lib/geckoterminal";

// Use Token's creator type
type CreatorProfile = NonNullable<Token["creator"]>;

export async function GET() {
  try {
    // Add cache control headers
    const headers = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    };

    // Fetch tokens
    const response = await fetch("https://api.streme.fun/api/tokens", {
      cache: "no-store",
    });
    const tokens: Token[] = await response.json();

    // Get unique creator IDs
    const creatorIds = [
      ...new Set(tokens.map((token) => token.requestor_fid?.toString())),
    ].filter(Boolean);

    // Fetch profile images if we have any creator IDs
    let creatorProfiles: Record<string, CreatorProfile> = {};
    if (creatorIds.length > 0) {
      const profileResponse = await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL
        }/api/fetchFarcasterProfile?userIds=${creatorIds.join(",")}`,
        { method: "GET" }
      );
      const profileData = await profileResponse.json();

      // Create a map of userId to profile image and name
      creatorProfiles =
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
        ) ?? {};
    }

    // Fetch both token and pool data
    const addresses = tokens.map((t) => t.contract_address);
    const geckoData = await fetchTokensData(addresses);

    // Log pool addresses for debugging
    console.log(
      "Pool Addresses:",
      tokens.map((t) => ({
        name: t.name,
        pool_address: t.pool_address,
      }))
    );

    // Fetch detailed pool data for each token
    const poolDataPromises = tokens.map((token) =>
      token.pool_address ? fetchPoolData(token.pool_address) : null
    );
    const poolData = await Promise.all(poolDataPromises);

    // Enrich tokens with all data
    const enrichedTokens = await Promise.all(
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

    return Response.json({ data: enrichedTokens }, { headers });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return Response.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}
