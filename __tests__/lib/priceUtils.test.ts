import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { 
  fetchETHPrice, 
  fetchTokenPrice, 
  getPrices, 
  convertToUSD, 
  formatUSDAmount 
} from '@/src/lib/priceUtils'

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('priceUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset module state including cache
    jest.resetModules()
  })

  describe('fetchETHPrice', () => {
    it('successfully fetches ETH price', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eth: 2500.50 })
      } as Response)

      const price = await fetchETHPrice()
      
      expect(price).toBe(2500.50)
      expect(mockFetch).toHaveBeenCalledWith('/api/eth-price')
    })

    it('returns null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response)

      const price = await fetchETHPrice()
      
      expect(price).toBeNull()
    })

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const price = await fetchETHPrice()
      
      expect(price).toBeNull()
    })

    it('returns null if no eth price in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response)

      const price = await fetchETHPrice()
      
      expect(price).toBeNull()
    })
  })

  describe('fetchTokenPrice', () => {
    it('successfully fetches token price from data.price', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { price: 0.001234 }
        })
      } as Response)

      const price = await fetchTokenPrice('0x123')
      
      expect(price).toBe(0.001234)
      expect(mockFetch).toHaveBeenCalledWith('/api/tokens/single?address=0x123')
    })

    it('successfully fetches token price from data.marketData.price', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { 
            marketData: { price: 0.005678 }
          }
        })
      } as Response)

      const price = await fetchTokenPrice('0x456')
      
      expect(price).toBe(0.005678)
    })

    it('successfully fetches token price from top level price', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          price: 0.009876
        })
      } as Response)

      const price = await fetchTokenPrice('0x789')
      
      expect(price).toBe(0.009876)
    })

    it('returns null on API error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response)

      const price = await fetchTokenPrice('0xabc')
      
      expect(price).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch token data for 0xabc: 404'
      )
      
      consoleWarnSpy.mockRestore()
    })

    it('returns null for invalid price values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { price: 'not-a-number' }
        })
      } as Response)

      const price = await fetchTokenPrice('0xdef')
      
      expect(price).toBeNull()
    })
  })

  describe('getPrices', () => {
    // Need to use require to properly reset module state for cache testing
    let priceUtils: any

    beforeEach(() => {
      jest.isolateModules(() => {
        priceUtils = require('@/src/lib/priceUtils')
      })
    })

    it('fetches ETH price and token prices', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ eth: 2500 })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { price: 0.001 } })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { price: 0.002 } })
        } as Response)

      const prices = await priceUtils.getPrices(['0x123', '0x456'])
      
      expect(prices).toEqual({
        eth: 2500,
        '0x123': 0.001,
        '0x456': 0.002
      })
    })

    it('uses cache for subsequent calls within cache duration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eth: 2500 })
      } as Response)

      const firstCall = await priceUtils.getPrices()
      const secondCall = await priceUtils.getPrices()
      
      expect(firstCall).toEqual({ eth: 2500 })
      expect(secondCall).toEqual({ eth: 2500 })
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once due to cache
    })

    it('skips empty token addresses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eth: 2500 })
      } as Response)

      const prices = await priceUtils.getPrices(['', '  ', null as any])
      
      expect(prices).toEqual({ eth: 2500 })
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only ETH price fetched
    })

    it('skips failed token price fetches', async () => {
      // Test that failed individual token fetches don't break the whole operation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ eth: 2500 })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { price: 0.002 } })
        } as Response)

      const prices = await priceUtils.getPrices(['0x404token', '0x456'])
      
      expect(prices).toEqual({
        eth: 2500,
        '0x456': 0.002
        // 0x404token is not included due to failed fetch
      })
    })

    it('normalizes token addresses to lowercase', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ eth: 2500 })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { price: 0.001 } })
        } as Response)

      const prices = await priceUtils.getPrices(['0xABC123'])
      
      expect(prices).toEqual({
        eth: 2500,
        '0xabc123': 0.001
      })
    })
  })

  describe('convertToUSD', () => {
    it('converts token amount to USD with proper decimals', () => {
      expect(convertToUSD('1', 2500)).toBe('$2500.00')
      expect(convertToUSD('0.5', 2500)).toBe('$1250.00')
      expect(convertToUSD('0.001', 2500)).toBe('$2.50')
    })

    it('handles very small amounts', () => {
      expect(convertToUSD('0.000001', 2500)).toBe('$0.002500')
      expect(convertToUSD('0.0000001', 2500)).toBe('$0.000250')
    })

    it('handles amounts less than $1', () => {
      expect(convertToUSD('0.0001', 2500)).toBe('$0.2500')
      expect(convertToUSD('0.00001', 2500)).toBe('$0.0250')
    })

    it('returns null for invalid inputs', () => {
      expect(convertToUSD('', 2500)).toBeNull()
      expect(convertToUSD('1', null)).toBeNull()
      expect(convertToUSD('abc', 2500)).toBeNull()
      expect(convertToUSD('0', 2500)).toBeNull()
      expect(convertToUSD('-5', 2500)).toBeNull()
    })

    it('accepts number input', () => {
      expect(convertToUSD(1.5, 2500)).toBe('$3750.00')
      expect(convertToUSD(0.0001, 2500)).toBe('$0.2500')
    })
  })

  describe('formatUSDAmount', () => {
    it('formats tiny amounts with 6 decimals', () => {
      expect(formatUSDAmount(0.000001)).toBe('$0.000001')
      expect(formatUSDAmount(0.005678)).toBe('$0.005678')
    })

    it('formats small amounts with 4 decimals', () => {
      expect(formatUSDAmount(0.1234)).toBe('$0.1234')
      expect(formatUSDAmount(0.9999)).toBe('$0.9999')
    })

    it('formats regular amounts with 2 decimals', () => {
      expect(formatUSDAmount(1)).toBe('$1.00')
      expect(formatUSDAmount(99.99)).toBe('$99.99')
      expect(formatUSDAmount(999.99)).toBe('$999.99')
    })

    it('formats thousands with K suffix', () => {
      expect(formatUSDAmount(1000)).toBe('$1.0K')
      expect(formatUSDAmount(1500)).toBe('$1.5K')
      expect(formatUSDAmount(999999)).toBe('$1000.0K')
    })

    it('formats millions with M suffix', () => {
      expect(formatUSDAmount(1000000)).toBe('$1.0M')
      expect(formatUSDAmount(1500000)).toBe('$1.5M')
      expect(formatUSDAmount(999999999)).toBe('$1000.0M')
    })

    it('handles edge cases between formats', () => {
      expect(formatUSDAmount(0.01)).toBe('$0.0100')
      expect(formatUSDAmount(0.009999)).toBe('$0.009999')
      expect(formatUSDAmount(1.001)).toBe('$1.00')
      expect(formatUSDAmount(999.999)).toBe('$1000.00')
    })
  })
})