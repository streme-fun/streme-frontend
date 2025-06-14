import { Token } from '@/src/app/types/token'

describe('Mock Data', () => {
  it('should provide valid mock tokens', () => {
    expect(mockTokens).toBeDefined()
    expect(mockTokens.length).toBeGreaterThan(0)
    expect(mockTokens[0]).toHaveProperty('contract_address')
    expect(mockTokens[0]).toHaveProperty('symbol')
  })
})

// Mock token data
export const mockTokens: Token[] = [
  {
    id: 1,
    created_at: '2023-11-15T00:00:00Z',
    tx_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    contract_address: '0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58',
    requestor_fid: 12345,
    name: 'Streme Token',
    symbol: 'STREME',
    img_url: '/icon-transparent.png',
    pool_address: '0x1234567890123456789012345678901234567890',
    cast_hash: '0xcasthash123',
    type: 'meme',
    pair: 'STREME/ETH',
    chain_id: 8453,
    metadata: {},
    profileImage: '/icon-transparent.png',
    pool_id: 'pool-1',
    staking_pool: '0x1234567890123456789012345678901234567890',
    staking_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    pfp_url: '/icon-transparent.png',
    username: 'streme_creator',
    timestamp: { _seconds: 1700000000, _nanoseconds: 0 },
    marketData: {
      price: 0.001,
      marketCap: 1000000,
      priceChange1h: 1.2,
      priceChange24h: 5.5,
      priceChange5m: 0.3,
      volume24h: 50000,
      lastUpdated: { _seconds: 1700000000, _nanoseconds: 0 },
    },
    price: 0.001,
    marketCap: 1000000,
    volume24h: 50000,
  },
  {
    id: 2,
    created_at: '2023-11-16T00:00:00Z',
    tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    contract_address: '0x4567890123456789012345678901234567890123',
    requestor_fid: 54321,
    name: 'Test Token',
    symbol: 'TEST',
    img_url: 'https://example.com/test-logo.png',
    pool_address: '0x2345678901234567890123456789012345678901',
    cast_hash: '0xcasthash456',
    type: 'utility',
    pair: 'TEST/ETH',
    chain_id: 8453,
    metadata: {},
    profileImage: 'https://example.com/test-logo.png',
    pool_id: 'pool-2',
    staking_pool: '0x2345678901234567890123456789012345678901',
    staking_address: '0xbcdef01234567890abcdef1234567890abcdef23',
    pfp_url: 'https://example.com/pfp.jpg',
    username: 'test_creator',
    timestamp: { _seconds: 1700100000, _nanoseconds: 0 },
    marketData: {
      price: 0.0005,
      marketCap: 500000,
      priceChange1h: -0.5,
      priceChange24h: -2.3,
      priceChange5m: -0.1,
      volume24h: 25000,
      lastUpdated: { _seconds: 1700100000, _nanoseconds: 0 },
    },
    price: 0.0005,
    marketCap: 500000,
    volume24h: 25000,
  },
]

// Mock user data
export const mockUser = {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e',
  farcaster: {
    fid: 12345,
    username: 'testuser',
    displayName: 'Test User',
    pfpUrl: 'https://example.com/pfp.jpg',
  },
}

// Mock transaction receipt
export const mockTransactionReceipt = {
  blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  blockNumber: BigInt(1234567),
  contractAddress: null,
  cumulativeGasUsed: BigInt(100000),
  effectiveGasPrice: BigInt(20000000000),
  from: mockUser.address,
  gasUsed: BigInt(50000),
  logs: [],
  logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  status: 'success' as const,
  to: mockTokens[0].contract_address,
  transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  transactionIndex: 1,
  type: 'eip1559' as const,
}

// Mock API responses
export const mockApiResponses = {
  tokens: {
    data: mockTokens,
    hasMore: false,
    nextPage: null,
  },
  singleToken: {
    data: mockTokens[0],
  },
  userBalance: {
    balance: '1000000000000000000', // 1 token
    stakedBalance: '500000000000000000', // 0.5 token
    isConnected: true,
  },
  supEligibility: {
    eligible: true,
    reason: 'User has staked tokens',
  },
  supPoints: {
    points: 1000,
    breakdown: {
      staking: 500,
      liquidity: 300,
      trading: 200,
    },
  },
}