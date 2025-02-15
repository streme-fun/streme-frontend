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
