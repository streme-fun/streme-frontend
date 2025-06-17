import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem'
import { base } from 'viem/chains'
import { jest, describe, it, expect } from '@jest/globals'

describe('Web3 Mocks', () => {
  it('should create mock public client', () => {
    const client = createMockPublicClient()
    expect(client).toBeDefined()
    expect(client.readContract).toBeDefined()
  })
})

// Mock addresses
export const MOCK_ADDRESSES = {
  user: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e' as const,
  token: '0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58' as const,
  stakingPool: '0x1234567890123456789012345678901234567890' as const,
  weth: '0x4200000000000000000000000000000000000006' as const,
}

// Mock transaction hash
export const MOCK_TX_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const

// Create mock viem clients
export const createMockPublicClient = (): any => {
  const getBalanceMock = jest.fn() as any
  getBalanceMock.mockResolvedValue(BigInt('1000000000000000000'))
  
  const estimateGasMock = jest.fn() as any
  estimateGasMock.mockResolvedValue(BigInt('100000'))
  
  const getGasPriceMock = jest.fn() as any
  getGasPriceMock.mockResolvedValue(BigInt('20000000000'))

  const client = {
    chain: base,
    transport: http(),
    readContract: jest.fn().mockImplementation((args: any) => {
      const { functionName } = args;
      switch (functionName) {
        case 'balanceOf':
          return Promise.resolve(BigInt('1000000000000000000')) // 1 token
        case 'allowance':
          return Promise.resolve(BigInt('0'))
        case 'decimals':
          return Promise.resolve(18)
        case 'symbol':
          return Promise.resolve('TEST')
        case 'name':
          return Promise.resolve('Test Token')
        default:
          return Promise.resolve(BigInt('0'))
      }
    }),
    getBalance: getBalanceMock,
    estimateGas: estimateGasMock,
    getGasPrice: getGasPriceMock,
  }

  return client
}

export const createMockWalletClient = (): any => {
  const writeContractMock = jest.fn() as any
  writeContractMock.mockResolvedValue(MOCK_TX_HASH)
  
  const sendTransactionMock = jest.fn() as any
  sendTransactionMock.mockResolvedValue(MOCK_TX_HASH)

  const client = {
    chain: base,
    transport: http(),
    writeContract: writeContractMock,
    sendTransaction: sendTransactionMock,
  }

  return client
}

// Mock Privy wallet
export const mockPrivyWallet = {
  address: MOCK_ADDRESSES.user,
  chainId: base.id,
  getEthereumProvider: jest.fn() as any,
  switchChain: jest.fn() as any,
  sign: jest.fn() as any,
}

// Setup mock implementations
mockPrivyWallet.getEthereumProvider.mockResolvedValue({
  request: jest.fn().mockImplementation((args: any) => {
    const { method } = args;
    switch (method) {
      case 'eth_requestAccounts':
        return Promise.resolve([MOCK_ADDRESSES.user])
      case 'eth_chainId':
        return Promise.resolve(`0x${base.id.toString(16)}`)
      default:
        return Promise.resolve(null)
    }
  }),
})
mockPrivyWallet.switchChain.mockResolvedValue(undefined)
mockPrivyWallet.sign.mockResolvedValue('0xmocksignature')

// Mock Farcaster context
export const mockFarcasterContext = {
  user: {
    fid: 12345,
    username: 'testuser',
    displayName: 'Test User',
    pfpUrl: 'https://example.com/pfp.jpg',
  },
  client: {
    clientFid: 'warpcast',
  },
}

// Mock token data
export const mockToken = {
  contract_address: MOCK_ADDRESSES.token,
  name: 'Test Token',
  symbol: 'TEST',
  decimals: 18,
  deployer: MOCK_ADDRESSES.user,
  timestamp: { _seconds: 1700000000 },
  logo_url: 'https://example.com/logo.png',
  staking_pool: MOCK_ADDRESSES.stakingPool,
  staking_address: '0xabcdef1234567890abcdef1234567890abcdef12',
  current_price: 0.001,
  market_cap: 1000000,
  marketData: {
    price: 0.001,
    marketCap: 1000000,
    priceChange24h: 5.5,
    volume24h: 50000,
    liquidity: 100000,
  },
}