import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GET } from '@/src/app/api/quote/route'
import { NextRequest } from 'next/server'

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('/api/quote', () => {
  const originalEnv = process.env.ZEROX_API_KEY
  
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ZEROX_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    process.env.ZEROX_API_KEY = originalEnv
  })

  it('successfully fetches a swap quote', async () => {
    const mockQuoteResponse = {
      chainId: 8453,
      buyAmount: '1000000000000000000',
      sellAmount: '2000000',
      price: '500',
      guaranteedPrice: '495',
      to: '0x1234567890123456789012345678901234567890',
      data: '0xabcdef',
      value: '0',
      gasPrice: '1000000000',
      gas: '150000',
      estimatedGas: '140000',
      protocolFee: '0',
      minimumProtocolFee: '0',
      buyTokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      sellTokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
      sources: [{ name: 'Uniswap', proportion: '1' }],
      allowanceTarget: '0x000000000022d473030f116ddee9f6b43ac78ba3'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockQuoteResponse,
      text: async () => JSON.stringify(mockQuoteResponse)
    } as Response)

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=0x1234567890abcdef1234567890abcdef12345678&buyToken=0xabcdef1234567890abcdef1234567890abcdef12&sellAmount=2000000&taker=0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockQuoteResponse)
    
    // Verify 0x API was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.0x.org/swap/permit2/quote?sellToken=0x1234567890abcdef1234567890abcdef12345678&buyToken=0xabcdef1234567890abcdef1234567890abcdef12&sellAmount=2000000&taker=0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e',
      {
        headers: {
          '0x-api-key': 'test-api-key',
          '0x-version': 'v2'
        }
      }
    )
  })

  it('handles missing API key', async () => {
    delete process.env.ZEROX_API_KEY

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'API key required'
    } as Response)

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=0x123&buyToken=0x456&sellAmount=1000'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('0x API error: Unauthorized')
  })

  it('handles 0x API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid token address'
    } as Response)

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=invalid&buyToken=0x456&sellAmount=1000'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('0x API error: Bad Request')
  })

  it('handles insufficient liquidity error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'No liquidity available'
    } as Response)

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=0x123&buyToken=0x456&sellAmount=999999999999999'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('0x API error: Not Found')
  })

  it('handles network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=0x123&buyToken=0x456&sellAmount=1000'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch quote data')
  })

  it('passes through all query parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ price: '100' })
    } as Response)

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=0x123&buyToken=0x456&sellAmount=1000&slippagePercentage=0.5&skipValidation=true'
    )

    await GET(request)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.0x.org/swap/permit2/quote?sellToken=0x123&buyToken=0x456&sellAmount=1000&slippagePercentage=0.5&skipValidation=true',
      expect.any(Object)
    )
  })

  it('logs quote request details', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ price: '100', buyAmount: '200' })
    } as Response)

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=0x123&buyToken=0x456&sellAmount=1000'
    )

    await GET(request)

    expect(consoleSpy).toHaveBeenCalledWith(
      'quote api',
      'https://api.0x.org/swap/permit2/quote?sellToken=0x123&buyToken=0x456&sellAmount=1000'
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'quote data',
      expect.stringContaining('"price": "100"')
    )

    consoleSpy.mockRestore()
  })

  it('logs error details on API failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded'
    } as Response)

    const request = new NextRequest(
      'http://localhost:3000/api/quote?sellToken=0x123&buyToken=0x456&sellAmount=1000'
    )

    await GET(request)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '0x API quote error:',
      429,
      'Rate limit exceeded'
    )

    consoleErrorSpy.mockRestore()
  })
})