import { Token } from "@/app/types/token";
import { enrichTokenWithMarketData } from "@/app/lib/mockTokens";

// Use Token's creator type
type CreatorProfile = NonNullable<Token["creator"]>;

export async function GET() {
  try {
    // Fetch tokens
    const response = await fetch("https://api.streme.fun/api/test/tokens");
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

    // Enrich tokens with profile data and market data
    const enrichedTokens = tokens.map((token, index) => {
      const enrichedToken = enrichTokenWithMarketData(token, index);
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
    });

    return Response.json({ data: enrichedTokens });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return Response.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}
