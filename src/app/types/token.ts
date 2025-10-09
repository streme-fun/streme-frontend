export interface Token {
  id: number;
  created_at: string;
  tx_hash: string;
  contract_address: string;
  requestor_fid: number;
  name: string;
  symbol: string;
  img_url: string | null;
  pool_address: string;
  cast_hash: string;
  type: string;
  pair: string;
  chain_id: number;
  metadata: Record<string, unknown>;
  profileImage: string | null;
  pool_id: string;
  staking_pool: string;
  staking_address: string;
  pfp_url: string;
  username: string;
  timestamp: {
    _seconds: number;
    _nanoseconds: number;
  };

  // Staking configuration (v2 tokens)
  staking?: {
    factory: string;
    token: string;
    pool: string;
    lockDuration: number;
    flowDuration: number;
    supply: number;
  };

  // Market data from Streme API
  marketData?: {
    marketCap: number;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange5m: number;
    volume24h: number;
    lastUpdated: {
      _seconds: number;
      _nanoseconds: number;
    };
  };

  price?: number;
  marketCap?: number;
  marketCapChange?: number;
  volume24h?: number;
  stakingAPY?: number;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  rewardDistributed?: number;
  rewardRate?: number;
  creator?: {
    name: string;
    score: number;
    recasts: number;
    likes: number;
    profileImage: string;
  };
}

export interface TokensResponse {
  data: Token[];
  hasMore: boolean;
  nextPage?: number;
}
