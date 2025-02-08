import { Token } from "../types/token";

// Helper function to create a token with common fields
export const enrichTokenWithMarketData = (
  token: Token,
  index: number
): Token => {
  const seed = index;
  const randomInRange = (min: number, max: number) => {
    const rand = Math.sin(seed) * 10000;
    return min + (rand - Math.floor(rand)) * (max - min);
  };

  const price = randomInRange(0.0001, 0.1);
  const marketCap = price * randomInRange(1000000, 10000000);

  return {
    ...token,
    decimals: 18,
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
    creator: {
      name: "Unknown",
      score: 0,
      recasts: 0,
      likes: 0,
      profileImage: "",
    },
  };
};
