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
  total: number;
}
