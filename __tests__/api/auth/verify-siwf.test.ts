import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { POST } from '@/src/app/api/auth/verify-siwf/route'
import { NextRequest } from 'next/server'

describe('/api/auth/verify-siwf', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('successfully verifies a valid SIWF message', async () => {
    const validMessage = 'streme.fun wants you to sign in with your Ethereum account:\n0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e\n\nfid:12345\n\nURI: https://streme.fun\nVersion: 1\nChain ID: 1\nNonce: abc123\nIssued At: 2024-01-01T00:00:00Z'
    
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': 'localhost:3000'
      },
      body: JSON.stringify({
        message: validMessage,
        signature: '0xmocksignature',
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
  })

  it('rejects message with invalid format', async () => {
    const invalidMessage = 'This is not a valid SIWF message'
    
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: invalidMessage,
        signature: '0xmocksignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Invalid SIWF message format')
  })

  it('rejects message without FID', async () => {
    const messageWithoutFid = 'streme.fun wants you to sign in with your Ethereum account:\n0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e\n\nNo FID here\n\nNonce: abc123'
    
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: messageWithoutFid,
        signature: '0xmocksignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Invalid SIWF message format')
  })

  it('rejects message without Ethereum address', async () => {
    const messageWithoutAddress = 'streme.fun wants you to sign in:\nfid:12345\nNonce: abc123'
    
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: messageWithoutAddress,
        signature: '0xmocksignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Invalid SIWF message format')
  })

  it('uses production domain in production environment', async () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true
    })
    
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    
    const validMessage = 'streme.fun wants you to sign in with your Ethereum account:\n0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e\n\nfid:12345\n\nNonce: abc123'
    
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': 'streme.fun'
      },
      body: JSON.stringify({
        message: validMessage,
        signature: '0xmocksignature',
        nonce: 'abc123'
      })
    })

    await POST(request)

    expect(consoleSpy).toHaveBeenCalledWith('SIWF verification using domain:', 'streme.fun')
    
    consoleSpy.mockRestore()
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true
    })
  })

  it('extracts domain from origin header for tunnel URLs', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    
    const validMessage = 'streme.fun wants you to sign in with your Ethereum account:\n0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e\n\nfid:12345\n\nNonce: abc123'
    
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': 'localhost:3000',
        'origin': 'https://abc123.ngrok.io'
      },
      body: JSON.stringify({
        message: validMessage,
        signature: '0xmocksignature',
        nonce: 'abc123'
      })
    })

    await POST(request)

    expect(consoleSpy).toHaveBeenCalledWith('SIWF verification using domain:', 'abc123.ngrok.io')
    
    consoleSpy.mockRestore()
  })

  it('generates valid session token with correct payload', async () => {
    const validMessage = 'streme.fun wants you to sign in with your Ethereum account:\n0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e\n\nfid:12345\n\nNonce: abc123'
    
    const request = new NextRequest('http://localhost:3000/api/auth/verify-siwf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: validMessage,
        signature: '0xmocksignature',
        nonce: 'abc123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    // Decode the base64 token
    const decodedToken = JSON.parse(Buffer.from(data.token, 'base64').toString())
    
    expect(decodedToken).toHaveProperty('fid', 12345)
    expect(decodedToken).toHaveProperty('address', '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e')
    expect(decodedToken).toHaveProperty('iat')
    expect(decodedToken).toHaveProperty('exp')
    
    // Check expiration is 24 hours from issuance
    expect(decodedToken.exp - decodedToken.iat).toBe(24 * 60 * 60)
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
})