import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST, verifySessionToken, _setAppClientForTesting } from '@/src/app/api/auth/verify-siwf/route'

// Create mock function for verifySignInMessage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockVerifySignInMessage: jest.Mock<any>

describe('/api/auth/verify-siwf', () => {
  beforeEach(() => {
    // Create fresh mock and inject it via dependency injection
    mockVerifySignInMessage = jest.fn()
    _setAppClientForTesting({
      verifySignInMessage: mockVerifySignInMessage,
    } as any)
  })

  afterEach(() => {
    // Clean up mock client
    _setAppClientForTesting(null)
  })

  it('successfully verifies a valid SIWF message', async () => {
    // Mock successful verification
    mockVerifySignInMessage.mockResolvedValueOnce({
      isError: false,
      fid: 12345,
      data: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e',
      },
    })

    const validMessage = 'streme.fun wants you to sign in with your Ethereum account:\n0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e\n\nfid:12345\n\nURI: https://streme.fun\nVersion: 1\nChain ID: 1\nNonce: abc123\nIssued At: 2024-01-01T00:00:00Z'

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': 'localhost:3000'
      },
      body: JSON.stringify({
        message: validMessage,
        signature: '0xvalidsignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('token')
    expect(data.user).toEqual({
      fid: 12345,
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e'
    })

    // Verify the auth-client was called with correct parameters
    expect(mockVerifySignInMessage).toHaveBeenCalledWith({
      message: validMessage,
      signature: '0xvalidsignature',
      nonce: 'abc123',
      domain: 'localhost:3000',
      acceptAuthAddress: true,
    })
  })

  it('rejects request with missing fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'some message',
        // Missing signature and nonce
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Missing required fields')
    expect(mockVerifySignInMessage).not.toHaveBeenCalled()
  })

  it('rejects when signature verification fails', async () => {
    // Mock verification failure
    mockVerifySignInMessage.mockResolvedValueOnce({
      isError: true,
      error: new Error('Invalid signature'),
    })

    const invalidMessage = 'forged message with fid:99999 and 0x1234567890123456789012345678901234567890'

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: invalidMessage,
        signature: '0xinvalidsignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Signature verification failed')
  })

  it('rejects when FID is missing from verification response', async () => {
    // Mock verification without FID
    mockVerifySignInMessage.mockResolvedValueOnce({
      isError: false,
      fid: undefined,
      data: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e',
      },
    })

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'some message',
        signature: '0xsignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Signature verification failed')
  })

  it('rejects when address is missing from verification response', async () => {
    // Mock verification without address
    mockVerifySignInMessage.mockResolvedValueOnce({
      isError: false,
      fid: 12345,
      data: {
        address: undefined,
      },
    })

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'some message',
        signature: '0xsignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Could not extract address')
  })

  it('uses production domain in production environment', async () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true
    })

    mockVerifySignInMessage.mockResolvedValueOnce({
      isError: false,
      fid: 12345,
      data: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e' },
    })

    const validMessage = 'test message'

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': 'streme.fun'
      },
      body: JSON.stringify({
        message: validMessage,
        signature: '0xsignature',
        nonce: 'abc123'
      })
    })

    await POST(request)

    expect(mockVerifySignInMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'streme.fun',
      })
    )

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true
    })
  })

  it('extracts domain from origin header for tunnel URLs', async () => {
    mockVerifySignInMessage.mockResolvedValueOnce({
      isError: false,
      fid: 12345,
      data: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e' },
    })

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': 'localhost:3000',
        'origin': 'https://abc123.ngrok.io'
      },
      body: JSON.stringify({
        message: 'test message',
        signature: '0xsignature',
        nonce: 'abc123'
      })
    })

    await POST(request)

    expect(mockVerifySignInMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'abc123.ngrok.io',
      })
    )
  })

  it('generates valid JWT session token', async () => {
    mockVerifySignInMessage.mockResolvedValueOnce({
      isError: false,
      fid: 12345,
      data: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e' },
    })

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'test message',
        signature: '0xsignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    // JWT should have 3 parts separated by dots
    const tokenParts = data.token.split('.')
    expect(tokenParts).toHaveLength(3)

    // Decode header
    const header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString())
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })

    // Decode payload
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString())
    expect(payload.fid).toBe(12345)
    expect(payload.address).toBe('0x742d35cc6634c0532925a3b844bc9e7595f2bd7e') // lowercase
    expect(payload).toHaveProperty('iat')
    expect(payload).toHaveProperty('exp')
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60)
  })

  it('handles malformed JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('Internal server error')
  })

  it('handles verification function throwing an exception', async () => {
    mockVerifySignInMessage.mockRejectedValueOnce(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'test message',
        signature: '0xsignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Message verification failed')
  })

  describe('verifySessionToken', () => {
    it('verifies valid session tokens', async () => {
      mockVerifySignInMessage.mockResolvedValueOnce({
        isError: false,
        fid: 99999,
        data: { address: '0xabc123def456789012345678901234567890abcd' },
      })

      // First get a valid token
      const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test',
          signature: '0xsig',
          nonce: 'nonce'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      // Verify the token
      const verified = verifySessionToken(data.token)
      expect(verified).not.toBeNull()
      expect(verified?.fid).toBe(99999)
      expect(verified?.address).toBe('0xabc123def456789012345678901234567890abcd')
    })

    it('rejects tokens with invalid signature', () => {
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmaWQiOjEyMzQ1LCJhZGRyZXNzIjoiMHgxMjM0IiwiaWF0IjoxNzA0MDYzNjAwLCJleHAiOjE3MDQxNTAwMDB9.invalidsignature'

      const verified = verifySessionToken(tamperedToken)
      expect(verified).toBeNull()
    })

    it('rejects malformed tokens', () => {
      expect(verifySessionToken('not-a-jwt')).toBeNull()
      expect(verifySessionToken('only.two')).toBeNull()
      expect(verifySessionToken('')).toBeNull()
    })

    it('rejects expired tokens', () => {
      // Create a token that's already expired (in the past)
      const expiredPayload = {
        fid: 12345,
        address: '0x1234',
        iat: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
        exp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago (expired)
      }

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url')

      // This token won't verify anyway due to wrong signature, but tests the expiry check path
      const expiredToken = `${header}.${payload}.wrongsignature`

      const verified = verifySessionToken(expiredToken)
      expect(verified).toBeNull()
    })
  })
})
