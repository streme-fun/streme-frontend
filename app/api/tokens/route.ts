import { Token } from "@/app/types/token";
import { mockTokens } from "@/app/lib/mockTokens";

const mockCreator = {
  name: "zeni",
  score: 79,
  recasts: 17,
  likes: 62,
};

function addMockData(token: Token, index: number): Token {
  const seed = index;
  const randomInRange = (min: number, max: number) => {
    const rand = Math.sin(seed) * 10000;
    return min + (rand - Math.floor(rand)) * (max - min);
  };

  const price = randomInRange(0.0001, 0.1);
  const marketCap = price * randomInRange(1000000, 10000000);

  return {
    ...token,
    id: index + 1000,
    price,
    marketCap,
    marketCapChange: randomInRange(-10, 10),
    volume24h: randomInRange(10000, 1000000),
    stakingAPY: randomInRange(5, 25),
    change1h: randomInRange(-5, 5),
    change24h: randomInRange(-15, 15),
    change7d: randomInRange(-30, 30),
    rewardDistributed: randomInRange(50000, 500000),
    rewardRate: randomInRange(1, 5),
    creator: mockCreator,
  };
}

export async function GET() {
  try {
    const response = await fetch("https://api.streme.fun/api/test/tokens");
    const tokens: Token[] = await response.json();

    const enrichedData = {
      data: [
        ...mockTokens,
        ...tokens.map((token, index) => addMockData(token, index)),
      ],
    };

    return Response.json(enrichedData);
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return Response.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}
