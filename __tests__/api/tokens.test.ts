import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GET } from '@/src/app/api/tokens/route'
import { NextRequest } from 'next/server'
import { mockTokens } from '../utils/mockData'

// Mock fetch for external APIs
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

describe('/api/tokens', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns tokens successfully', async () => {
    // Mock successful API response
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockTokens,
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/tokens')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveLength(mockTokens.length)
    expect(data.data[0]).toMatchObject({
      contract_address: expect.any(String),
      name: expect.any(String),
      symbol: expect.any(String),
    })
  })

  it('handles pagination with before parameter', async () => {
    const paginatedTokens = mockTokens.slice(0, 1)
    
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(paginatedTokens),
    })

    const request = new NextRequest('http://localhost:3000/api/tokens?before=1234567890&limit=1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.hasMore).toBe(true) // true because we requested limit=1 but there might be more
    expect(data.nextPage).toBe(paginatedTokens[0].timestamp._seconds)
  })


  it('handles API errors gracefully', async () => {
    // Mock API error - fetchTokensFromStreme returns empty array on error
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    })

    const request = new NextRequest('http://localhost:3000/api/tokens')
    const response = await GET(request)

    expect(response.status).toBe(200) // API still returns 200
    
    const data = await response.json()
    expect(data.data).toEqual([]) // But with empty data
    expect(data.hasMore).toBe(false)
  })

  it('handles network errors', async () => {
    // Mock network error - fetchTokensFromStreme catches and returns empty array
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/tokens')
    const response = await GET(request)

    expect(response.status).toBe(200) // API still returns 200
    
    const data = await response.json()
    expect(data.data).toEqual([]) // But with empty data
    expect(data.hasMore).toBe(false)
  })

  it('enriches tokens with market data', async () => {
    // Mock Streme API response with tokens that already have market data
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTokens),
    })

    const request = new NextRequest('http://localhost:3000/api/tokens')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveLength(2)
    expect(data.data[0].price).toBe(mockTokens[0].marketData?.price)
    expect(data.data[0].marketCap).toBe(mockTokens[0].marketData?.marketCap)
    expect(data.data[0].volume24h).toBe(mockTokens[0].marketData?.volume24h)
  })

})