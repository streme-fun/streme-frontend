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
    allocation?: number; // percentage of total supply
    delegate?: string; // optional delegate address
  };

  // Vault configuration (v2 tokens) - single vault (legacy)
  vault?: {
    allocation: number; // percentage of total supply
    beneficiary: string | string[]; // single or multiple beneficiaries
    lockDuration: number;
    vestingDuration: number;
    supply: number;
  };

  // Multiple vaults configuration (v2 tokens) - supports multiple vaults
  vaults?: Array<{
    allocation?: number; // percentage of total supply (optional, can be calculated from supply)
    beneficiary?: string | string[]; // single or multiple beneficiaries
    admin?: string; // beneficiary address (alternative field name from database)
    lockDuration?: number; // lock duration in seconds
    lockupDuration?: number; // alternative field name from database
    vestingDuration?: number; // vesting duration in seconds
    supply: number; // actual token amount allocated
  }>;

  // Token allocation breakdown
  allocations?: {
    staking: number; // percentage
    vault: number; // percentage - total vault allocation across all vaults
    liquidity: number; // percentage
  };

  // Optional description
  description?: string;

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
