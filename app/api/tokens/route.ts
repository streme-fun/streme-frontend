import { Token } from "@/app/types/token"; // Import existing Token type
import {
  fetchTokensFromStreme,
  fetchCreatorProfiles,
  enrichTokensWithData,
} from "@/app/lib/apiUtils";

type CreatorProfile = Record<
  string,
  {
    name: string;
    score: number;
    recasts: number;
    likes: number;
    profileImage: string;
  }
>;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface EnrichedToken extends Token {
  poolData: {
    price?: number;
    marketCap?: number;
    volume24h?: number;
    total_reserve_in_usd?: number;
  } | null;
  error?: string;
}

const processBatchWithRetry = async (
  tokens: Token[],
  creatorProfiles: CreatorProfile,
  batchSize: number = 5
): Promise<EnrichedToken[]> => {
  const results: EnrichedToken[] = [];

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    let retries = 3;

    while (retries > 0) {
      try {
        if (i > 0) await delay(1000);

        const enrichedBatch = (await enrichTokensWithData(
          batch,
          creatorProfiles
        )) as unknown as EnrichedToken[];
        results.push(...enrichedBatch);
        break;
      } catch (error) {
        console.warn(
          `Batch ${i / batchSize} attempt ${4 - retries} failed:`,
          error
        );
        retries--;

        if (retries === 0) {
          results.push(
            ...batch.map((token) => ({
              ...token,
              poolData: null,
              error: "Failed to fetch pool data",
            }))
          );
          break;
        }

        await delay(1000 * Math.pow(2, 3 - retries));
      }
    }
  }

  return results;
};

export async function GET() {
  try {
    const headers = {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    };

    // Fetch all tokens
    const allTokens = await fetchTokensFromStreme();
    const tokens = allTokens;

    const creatorIds = [
      ...new Set(tokens.map((token) => token.requestor_fid?.toString())),
    ].filter(Boolean);

    // Fetch creator profiles
    const creatorProfiles = await fetchCreatorProfiles(creatorIds);

    // Process tokens in batches with retry logic
    const enrichedTokens = await processBatchWithRetry(tokens, creatorProfiles);

    return Response.json({ data: enrichedTokens }, { headers });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return Response.json(
      {
        error: "Failed to fetch tokens",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
