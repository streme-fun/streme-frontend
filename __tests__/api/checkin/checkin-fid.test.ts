import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { GET } from '@/src/app/api/checkin/[fid]/route'
import { _setAppClientForTesting } from '@/src/app/api/auth/verify-siwf/route'

// Helper to generate a valid test token
function generateTestToken(fid: number, address: string): string {
  const { createHmac } = require('crypto')
  const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'streme-auth-secret-change-in-production'

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    fid,
    address: address.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url')

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

// Mock fetch for external API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = jest.fn<any>()
global.fetch = mockFetch as unknown as typeof fetch

describe('/api/checkin/[fid]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set up mock auth client (not used directly but needed for verifySessionToken)
    _setAppClientForTesting({
      verifySignInMessage: jest.fn(),
    } as any)
  })

  afterEach(() => {
    _setAppClientForTesting(null)
  })

  it('rejects requests without authentication', async () => {
    const request = new NextRequest('http://localhost:3000/api/checkin/12345', {
      method: 'GET',
    })

    const response = await GET(request, { params: Promise.resolve({ fid: '12345' }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authentication required')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects requests with invalid token', async () => {
    const request = new NextRequest('http://localhost:3000/api/checkin/12345', {
      method: 'GET',
      headers: {
        'authorization': 'Bearer invalid-token',
      },
    })

    const response = await GET(request, { params: Promise.resolve({ fid: '12345' }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid or expired token')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects requests for other users check-in data', async () => {
    const token = generateTestToken(12345, '0x1234567890abcdef')

    const request = new NextRequest('http://localhost:3000/api/checkin/99999', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
      },
    })

    const response = await GET(request, { params: Promise.resolve({ fid: '99999' }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Access denied')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('allows users to access their own check-in data', async () => {
    const token = generateTestToken(12345, '0x1234567890abcdef')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fid: 12345,
        checkedInToday: true,
        lastCheckinDate: '2026-01-29',
        totalCheckins: 10,
        currentStreak: 5,
        dropHistory: [
          { date: '2026-01-29', amount: '100', txHash: '0xabc123' },
        ],
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/checkin/12345', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
      },
    })

    const response = await GET(request, { params: Promise.resolve({ fid: '12345' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fid).toBe(12345)
    expect(data.totalCheckins).toBe(10)
    expect(data.currentStreak).toBe(5)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.streme.fun/api/checkin/12345',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('rejects invalid FID format', async () => {
    const token = generateTestToken(12345, '0x1234567890abcdef')

    const request = new NextRequest('http://localhost:3000/api/checkin/invalid', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
      },
    })

    const response = await GET(request, { params: Promise.resolve({ fid: 'invalid' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid FID')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('handles external API errors', async () => {
    const token = generateTestToken(12345, '0x1234567890abcdef')

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    })

    const request = new NextRequest('http://localhost:3000/api/checkin/12345', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
      },
    })

    const response = await GET(request, { params: Promise.resolve({ fid: '12345' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch checkin status')
  })

  it('handles network errors gracefully', async () => {
    const token = generateTestToken(12345, '0x1234567890abcdef')

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/checkin/12345', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
      },
    })

    const response = await GET(request, { params: Promise.resolve({ fid: '12345' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  it('rejects expired tokens', async () => {
    const { createHmac } = require('crypto')
    const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'streme-auth-secret-change-in-production'

    // Create an expired token
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = {
      fid: 12345,
      address: '0x1234567890abcdef',
      iat: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
      exp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago (expired)
    }

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url')

    const expiredToken = `${encodedHeader}.${encodedPayload}.${signature}`

    const request = new NextRequest('http://localhost:3000/api/checkin/12345', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${expiredToken}`,
      },
    })

    const response = await GET(request, { params: Promise.resolve({ fid: '12345' }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid or expired token')
  })
})
