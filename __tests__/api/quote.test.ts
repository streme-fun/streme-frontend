import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GET } from '@/src/app/api/quote/route'
import { NextRequest } from 'next/server'

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Valid Ethereum addresses for testing (lowercase to avoid checksum issues)
const VALID_SELL_TOKEN = '0x1234567890abcdef1234567890abcdef12345678'
const VALID_BUY_TOKEN = '0xabcdef1234567890abcdef1234567890abcdef12'
const VALID_TAKER = '0x742d35cc6634c0532925a3b844bc9e7595f2bd7e'
const VALID_SELL_AMOUNT = '2000000'
const VALID_CHAIN_ID = '8453'

// Helper to build valid query string
const buildQueryString = (params: Record<string, string>) => {
  return new URLSearchParams(params).toString()
}

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
      buyTokenAddress: VALID_BUY_TOKEN,
      sellTokenAddress: VALID_SELL_TOKEN,
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

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: VALID_SELL_AMOUNT,
      taker: VALID_TAKER,
      chainId: VALID_CHAIN_ID
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockQuoteResponse)

    // Verify 0x API was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.0x.org/swap/permit2/quote?${queryString}`,
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

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: VALID_SELL_AMOUNT,
      chainId: VALID_CHAIN_ID
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

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

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: VALID_SELL_AMOUNT,
      chainId: VALID_CHAIN_ID
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

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

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: '999999999999999',
      chainId: VALID_CHAIN_ID
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('0x API error: Not Found')
  })

  it('handles network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: VALID_SELL_AMOUNT,
      chainId: VALID_CHAIN_ID
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

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

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: VALID_SELL_AMOUNT,
      chainId: VALID_CHAIN_ID,
      slippagePercentage: '0.5',
      skipValidation: 'true'
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

    await GET(request)

    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.0x.org/swap/permit2/quote?${queryString}`,
      expect.any(Object)
    )
  })

  it('does not log sensitive data on success', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ price: '100', buyAmount: '200' })
    } as Response)

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: VALID_SELL_AMOUNT,
      chainId: VALID_CHAIN_ID
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

    await GET(request)

    // Should not log URLs or response data (security)
    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('logs minimal error info on API failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded'
    } as Response)

    const queryString = buildQueryString({
      sellToken: VALID_SELL_TOKEN,
      buyToken: VALID_BUY_TOKEN,
      sellAmount: VALID_SELL_AMOUNT,
      chainId: VALID_CHAIN_ID
    })

    const request = new NextRequest(`http://localhost:3000/api/quote?${queryString}`)

    await GET(request)

    // Should only log status code, not response body (security)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '0x API quote error:',
      429
    )

    consoleErrorSpy.mockRestore()
  })

  // New tests for input validation
  describe('input validation', () => {
    it('rejects invalid sellToken address', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/quote?sellToken=not-valid&buyToken=${VALID_BUY_TOKEN}&sellAmount=${VALID_SELL_AMOUNT}&chainId=${VALID_CHAIN_ID}`
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('sellToken')
    })

    it('rejects invalid buyToken address', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/quote?sellToken=${VALID_SELL_TOKEN}&buyToken=0x123&sellAmount=${VALID_SELL_AMOUNT}&chainId=${VALID_CHAIN_ID}`
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('buyToken')
    })

    it('rejects missing required parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/quote?sellToken=' + VALID_SELL_TOKEN)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('rejects invalid chainId', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/quote?sellToken=${VALID_SELL_TOKEN}&buyToken=${VALID_BUY_TOKEN}&sellAmount=${VALID_SELL_AMOUNT}&chainId=invalid`
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('chainId')
    })
  })
})
