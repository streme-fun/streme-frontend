interface TokenAttributes {
  name: string;
  symbol: string;
  created_at: string;
  contract_address: string;
  staking_pool?: string;
  staking_address?: string;
  pool_address?: string;
  cast_hash?: string;
  img_url?: string;
}

interface TokenRelationships {
  requestor?: {
    data: {
      id: string;
      type: string;
    };
  };
}

export interface Token {
  id: string;
  type: string;
  attributes: TokenAttributes;
  relationships: TokenRelationships;
  requestor_fid?: string;
}

export type CreatorProfile = Record<
  string,
  {
    name: string;
    score: number;
    recasts: number;
    likes: number;
    profileImage: string;
  }
>;

// New interface for launched tokens from external API
export interface LaunchedToken {
  id: number;
  block_number: number;
  tx_hash: string;
  contract_address: string;
  requestor_fid: number;
  deployer: string;
  name: string;
  symbol: string;
  img_url: string;
  cast_hash: string;
  type: string;
  pair: string;
  presale_id?: string;
  chain_id: number;
  metadata?: Record<string, unknown> | null;
  tokenFactory: string;
  postDeployHook: string;
  liquidityFactory: string;
  postLpHook: string;
  poolConfig: {
    tick: number;
    pairedToken: string;
    devBuyFee: number;
  };
  channel?: string;
  timestamp: {
    _seconds: number;
    _nanoseconds: number;
  };
  staking_pool: string;
  staking_address: string;
  pool_address: string;
  username: string;
  pfp_url: string;
  lastTraded: {
    _seconds: number;
    _nanoseconds: number;
  };
  marketData: {
    marketCap: number;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange5m: number;
    volume24h: number | null;
    lastUpdated: {
      _seconds: number;
      _nanoseconds: number;
    };
  };
  created_at: string;

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

  // Vault configuration (v2 tokens)
  vault?: {
    allocation: number; // percentage of total supply
    beneficiary: string | string[]; // single or multiple beneficiaries
    admin?: string;
    lockDuration: number;
    vestingDuration: number;
    supply: number;
    pool?: string;
    box?: string;
    lockupEndTime?: number;
    vestingEndTime?: number;
  };

  vaults?: Array<{
    vault: string;
    token: string;
    admin: string;
    supply: number;
    lockupDuration: number;
    vestingDuration: number;
    pool?: string;
    box?: string;
    lockupEndTime?: number;
    vestingEndTime?: number;
  }>;

  // Token allocation breakdown
  allocations?: {
    staking: number; // percentage
    vault: number; // percentage
    liquidity: number; // percentage
  };
}
