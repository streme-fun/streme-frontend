import { Token } from "../types/token";

const mockCreator = {
  name: "zeni",
  score: 79,
  recasts: 17,
  likes: 62,
};

// Helper function to create a token with common fields
const createToken = (
  id: number,
  address: string,
  name: string,
  symbol: string,
  marketCap: number,
  marketCapChange: number,
  volume24h: number,
  img_url: string
): Token => ({
  id,
  created_at: new Date().toISOString(),
  tx_hash: `0x${id}`,
  contract_address: address,
  requestor_fid: id,
  name,
  symbol,
  img_url,
  pool_address: address.replace("0x", "0xpool"),
  cast_hash: `0x${id}`,
  type: "token",
  pair: "WETH",
  chain_id: 8453,
  metadata: {},
  price: marketCap / 1000000,
  marketCap,
  marketCapChange,
  volume24h,
  stakingAPY: 120 + (id % 50),
  change1h: marketCapChange * 0.5,
  change24h: marketCapChange * 2,
  change7d: marketCapChange * 4,
  rewardDistributed: marketCap * 0.1,
  rewardRate: 1 + (id % 2),
  creator: mockCreator,
});

export const mockTokens: Token[] = [
  createToken(
    999999,
    "0x1234567890123456789012345678901234567890",
    "Based Fwog",
    "FWOG",
    459510,
    12.77,
    12420,
    "/tokens/skimochi.avif"
  ),
  createToken(
    999998,
    "0x2345678901234567890123456789012345678901",
    "PEPE Streamer",
    "PEPEC",
    214120,
    2.24,
    49620,
    "/tokens/streamer.jpeg"
  ),
  createToken(
    999996,
    "0x4567890123456789012345678901234567890123",
    "dogwifstreamer",
    "WIF",
    61700,
    -1.56,
    1020,
    "/tokens/dogwhif.jpeg"
  ),
  createToken(
    999995,
    "0x5678901234567890123456789012345678901234",
    "StreamPepe",
    "SPEPE",
    358000,
    2.5,
    89246,
    "/tokens/pepe.jpeg"
  ),
  createToken(
    999993,
    "0x7890123456789012345678901234567890123456",
    "RiverRocket",
    "RVRKT",
    725000,
    -0.8,
    123456,
    "/tokens/riverdog.jpg"
  ),
  createToken(
    999990,
    "0xA123456789012345678901234567890123456789",
    "TorrentMoon",
    "TRMOON",
    180000,
    0.1,
    24875,
    "/tokens/moon.jpeg"
  ),
  createToken(
    999989,
    "0xB123456789012345678901234567890123456789",
    "FluxFloki",
    "FLXFLK",
    267000,
    -0.2,
    42187,
    ""
  ),
  createToken(
    999988,
    "0xC123456789012345678901234567890123456789",
    "RapidRabbit",
    "RPDRBT",
    391000,
    0.4,
    54762,
    "/tokens/riverrabbit.jpeg"
  ),
  createToken(
    999985,
    "0xF123456789012345678901234567890123456789",
    "StreamStonks",
    "STRNK",
    272000,
    0.3,
    47623,
    "/tokens/rivercat.jpg"
  ),
];
