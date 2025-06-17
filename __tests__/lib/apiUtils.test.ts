import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { 
  fetchTokensFromStreme, 
  fetchTokenFromStreme, 
  enrichTokensWithData 
} from '@/src/lib/apiUtils'
import { mockTokens } from '../utils/mockData'

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('apiUtils', () => {
  describe('fetchTokensFromStreme', () => {
    it('fetches tokens successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      } as Response)
      
      const result = await fetchTokensFromStreme()
      
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('contract_address')
      expect(result[0]).toHaveProperty('name')
      expect(result[0]).toHaveProperty('symbol')
    })

    it('handles limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens.slice(0, 1),
      } as Response)
      
      const result = await fetchTokensFromStreme(undefined, 1)
      
      expect(result).toHaveLength(1)
    })

    it('handles before parameter for pagination', async () => {
      const filteredTokens = mockTokens.slice(1) // Exclude first token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => filteredTokens,
      } as Response)
      
      const beforeTimestamp = mockTokens[0].timestamp._seconds + 1
      const result = await fetchTokensFromStreme(beforeTimestamp, 200)
      
      expect(result).toHaveLength(1) // Should exclude first token
    })

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      const result = await fetchTokensFromStreme()
      
      expect(result).toEqual([])
    })
  })

  describe('fetchTokenFromStreme', () => {
    it('fetches single token successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockTokens[0] }),
      } as Response)
      
      const tokenAddress = mockTokens[0].contract_address
      const result = await fetchTokenFromStreme(tokenAddress)
      
      expect(result).toBeDefined()
      expect(result?.contract_address).toBe(tokenAddress)
      expect(result?.name).toBe(mockTokens[0].name)
    })

    it('handles token not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'No such document!' }),
      } as Response)
      
      const invalidAddress = '0xinvalidaddress'
      const result = await fetchTokenFromStreme(invalidAddress)
      
      expect(result).toBeNull()
    })

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      const tokenAddress = mockTokens[0].contract_address
      const result = await fetchTokenFromStreme(tokenAddress)
      
      expect(result).toBeNull()
    })

    it('normalizes address to lowercase', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockTokens[0] }),
      } as Response)
      
      const upperCaseAddress = mockTokens[0].contract_address.toUpperCase()
      const result = await fetchTokenFromStreme(upperCaseAddress)
      
      expect(result).toBeDefined()
      expect(result?.contract_address).toBe(mockTokens[0].contract_address)
      
      // Verify fetch was called with lowercase address
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.streme.fun/token/${mockTokens[0].contract_address}`,
        expect.any(Object)
      )
    })
  })

  describe('enrichTokensWithData', () => {
    it('enriches tokens with creator data', async () => {
      const result = await enrichTokensWithData(mockTokens)
      
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('creator')
      expect(result[0].creator).toHaveProperty('name')
      expect(result[0].creator).toHaveProperty('profileImage')
    })

    it('handles tokens without requestor_fid', async () => {
      const tokensWithoutFid = mockTokens.map(token => {
        const { requestor_fid, ...rest } = token;
        return rest;
      }) as any[]
      
      const result = await enrichTokensWithData(tokensWithoutFid)
      
      expect(result).toHaveLength(2)
      expect(result[0].creator).toBeUndefined()
    })

    it('handles invalid input gracefully', async () => {
      const result = await enrichTokensWithData(null as any)
      
      expect(result).toEqual([])
    })

    it('maps market data correctly', async () => {
      const result = await enrichTokensWithData(mockTokens)
      
      expect(result[0].price).toBe(mockTokens[0].marketData?.price)
      expect(result[0].marketCap).toBe(mockTokens[0].marketData?.marketCap)
      expect(result[0].volume24h).toBe(mockTokens[0].marketData?.volume24h)
      expect(result[0].change1h).toBe(mockTokens[0].marketData?.priceChange1h)
      expect(result[0].change24h).toBe(mockTokens[0].marketData?.priceChange24h)
    })
  })
})