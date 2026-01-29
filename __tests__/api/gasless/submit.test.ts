import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { POST } from '@/src/app/api/gasless/submit/route'
import { NextRequest } from 'next/server'

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Valid test data that passes input validation
const VALID_SIGNATURE = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12'
const VALID_CHAIN_ID = 8453

const createValidRequestBody = (overrides = {}) => ({
  trade: {
    to: '0x1234567890123456789012345678901234567890',
    data: '0xabcdef',
    value: '0',
    gasPrice: '1000000000',
    gas: '150000'
  },
  signature: VALID_SIGNATURE,
  taker: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e',
  chainId: VALID_CHAIN_ID,
  ...overrides
})

describe('/api/gasless/submit', () => {
  const originalEnv = process.env.ZEROX_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ZEROX_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    process.env.ZEROX_API_KEY = originalEnv
  })

  it('successfully submits a gasless transaction', async () => {
    const mockSubmitResponse = {
      tradeHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 'pending',
      estimatedAt: '2024-01-01T00:00:00Z',
      estimatedGas: '150000'
    }

    const mockRequestBody = createValidRequestBody()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockSubmitResponse,
      text: async () => JSON.stringify(mockSubmitResponse)
    } as Response)

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mockRequestBody)
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockSubmitResponse)

    // Verify 0x API was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.0x.org/gasless/submit',
      {
        method: 'POST',
        headers: {
          '0x-api-key': 'test-api-key',
          '0x-version': 'v2',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mockRequestBody)
      }
    )
  })

  it('handles 0x API returning invalid signature error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid signature'
    } as Response)

    const mockRequestBody = createValidRequestBody()

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mockRequestBody)
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('0x Gasless API error: Bad Request')
  })

  it('handles missing API key', async () => {
    delete process.env.ZEROX_API_KEY

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'API key required'
    } as Response)

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createValidRequestBody())
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('0x Gasless API error: Unauthorized')
  })

  it('handles rate limiting', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded'
    } as Response)

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createValidRequestBody())
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain('0x Gasless API error: Too Many Requests')
  })

  it('handles network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createValidRequestBody())
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to submit gasless transaction')
  })

  it('handles malformed request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to submit gasless transaction')
  })

  it('does not log sensitive data on success', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    const mockSubmitResponse = {
      tradeHash: '0x123',
      status: 'pending'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSubmitResponse
    } as Response)

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createValidRequestBody())
    })

    await POST(request)

    // Should not log response data (security)
    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('logs minimal error info on API failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Insufficient balance'
    } as Response)

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createValidRequestBody())
    })

    await POST(request)

    // Should only log status code, not response body (security)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '0x Gasless API submit error:',
      403
    )

    consoleErrorSpy.mockRestore()
  })

  it('preserves all fields from request body', async () => {
    const complexRequestBody = createValidRequestBody({
      trade: {
        to: '0x1234567890123456789012345678901234567890',
        data: '0xabcdef',
        value: '1000000000000000000', // 1 ETH
        gasPrice: '2000000000',
        gas: '300000',
        nonce: 42
      },
      permit2: {
        eip712: {
          domain: {},
          types: {},
          primaryType: 'Permit2',
          message: {}
        }
      }
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tradeHash: '0x123' })
    } as Response)

    const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(complexRequestBody)
    })

    await POST(request)

    // Verify the complete body was forwarded
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.0x.org/gasless/submit',
      expect.objectContaining({
        body: JSON.stringify(complexRequestBody)
      })
    )
  })

  // New tests for input validation
  describe('input validation', () => {
    it('rejects missing trade field', async () => {
      const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: VALID_SIGNATURE,
          chainId: VALID_CHAIN_ID
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'trade'")
    })

    it('rejects invalid signature format', async () => {
      const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade: { to: '0x123' },
          signature: 'not-a-hex-string',
          chainId: VALID_CHAIN_ID
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'signature'")
    })

    it('rejects missing chainId', async () => {
      const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade: { to: '0x123' },
          signature: VALID_SIGNATURE
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'chainId'")
    })

    it('rejects invalid approvalSignature format', async () => {
      const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createValidRequestBody(),
          approvalSignature: 'not-valid-hex'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain("'approvalSignature'")
    })

    it('accepts valid approvalSignature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tradeHash: '0x123' })
      } as Response)

      const request = new NextRequest('http://localhost:3000/api/gasless/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createValidRequestBody(),
          approval: { type: 'permit2' },
          approvalSignature: '0xabcdef1234567890'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })
})
