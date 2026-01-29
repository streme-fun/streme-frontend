import { describe, it, expect } from '@jest/globals'
import {
  tokensPerDayToFlowRate,
  flowRateToTokensPerDay,
  flowRateToTokensPerDayString,
} from '@/src/lib/superfluid-streaming'
import { calculateWeeklyAmount } from '@/src/lib/superfluid-pools'

describe('Superfluid precision tests', () => {
  describe('tokensPerDayToFlowRate', () => {
    it('converts small values correctly', () => {
      // 1 token per day should be 1e18 / 86400 wei per second
      const flowRate = tokensPerDayToFlowRate(1)
      const expectedFlowRate = BigInt(10n ** 18n / 86400n)
      expect(flowRate).toBe(expectedFlowRate)
    })

    it('converts 100 tokens per day correctly', () => {
      const flowRate = tokensPerDayToFlowRate(100)
      // 100 * 1e18 / 86400 = 1157407407407407407 wei/sec
      expect(flowRate).toBe(100n * 10n ** 18n / 86400n)
    })

    it('handles decimal values', () => {
      // 0.5 tokens per day
      const flowRate = tokensPerDayToFlowRate(0.5)
      expect(flowRate).toBe(5n * 10n ** 17n / 86400n)
    })

    it('handles string input', () => {
      const flowRate = tokensPerDayToFlowRate('100.5')
      // Should correctly parse the string
      expect(flowRate).toBeGreaterThan(0n)
    })

    it('handles large values without precision loss', () => {
      // 1 million tokens per day
      const flowRate = tokensPerDayToFlowRate(1000000)
      const expected = 1000000n * 10n ** 18n / 86400n
      expect(flowRate).toBe(expected)
    })
  })

  describe('flowRateToTokensPerDay', () => {
    it('converts flow rate to tokens per day', () => {
      // Flow rate of 1e18 / 86400 should give ~1 token per day
      const flowRate = 10n ** 18n / 86400n
      const tokensPerDay = flowRateToTokensPerDay(flowRate)
      // Allow small floating point tolerance
      expect(tokensPerDay).toBeCloseTo(1, 4)
    })

    it('handles zero flow rate', () => {
      const tokensPerDay = flowRateToTokensPerDay(0n)
      expect(tokensPerDay).toBe(0)
    })

    it('is inverse of tokensPerDayToFlowRate for typical values', () => {
      const originalTokensPerDay = 100
      const flowRate = tokensPerDayToFlowRate(originalTokensPerDay)
      const result = flowRateToTokensPerDay(flowRate)
      // Allow small tolerance due to integer division
      expect(result).toBeCloseTo(originalTokensPerDay, 5)
    })
  })

  describe('flowRateToTokensPerDayString', () => {
    it('returns full precision string', () => {
      const flowRate = 10n ** 18n / 86400n
      const result = flowRateToTokensPerDayString(flowRate)
      // Should return a string representation
      expect(typeof result).toBe('string')
      expect(parseFloat(result)).toBeCloseTo(1, 4)
    })

    it('handles large values', () => {
      // Very large flow rate
      const flowRate = 10n ** 22n // 10000 tokens per second in wei
      const result = flowRateToTokensPerDayString(flowRate)
      // Should be 10000 * 86400 = 864,000,000 tokens per day
      expect(parseFloat(result)).toBeCloseTo(864000000, 0)
    })
  })

  describe('calculateWeeklyAmount', () => {
    it('calculates weekly amount from daily flow rate', () => {
      // 100 tokens per day should be 700 tokens per week in wei
      const dailyFlowRate = '100'
      const weeklyAmount = calculateWeeklyAmount(dailyFlowRate)
      expect(weeklyAmount).toBe(700n * 10n ** 18n)
    })

    it('handles zero', () => {
      expect(calculateWeeklyAmount('0')).toBe(0n)
      expect(calculateWeeklyAmount('')).toBe(0n)
    })

    it('handles decimal values', () => {
      const dailyFlowRate = '100.5'
      const weeklyAmount = calculateWeeklyAmount(dailyFlowRate)
      // 100.5 * 7 = 703.5 tokens
      expect(weeklyAmount).toBe(7035n * 10n ** 17n)
    })

    it('handles very large values without precision loss', () => {
      // 1 billion tokens per day
      const dailyFlowRate = '1000000000'
      const weeklyAmount = calculateWeeklyAmount(dailyFlowRate)
      // Should be 7 billion tokens in wei
      const expected = 7n * 10n ** 27n
      expect(weeklyAmount).toBe(expected)
    })

    it('preserves precision for values near Number.MAX_SAFE_INTEGER', () => {
      // Test with value that would overflow Number precision
      // Number.MAX_SAFE_INTEGER is about 9 * 10^15
      // With 18 decimals, that's only about 9 tokens
      // So let's test with 10 tokens per day (which in wei is 10^19)
      const dailyFlowRate = '10'
      const weeklyAmount = calculateWeeklyAmount(dailyFlowRate)
      expect(weeklyAmount).toBe(70n * 10n ** 18n)
    })
  })

  describe('BigInt precision edge cases', () => {
    it('handles values that would overflow Number precision', () => {
      // Number.MAX_SAFE_INTEGER = 9007199254740991
      // In token terms (with 18 decimals), this is about 0.009 tokens
      // Any flow rate above this would have precision issues with Number

      // Test with a large but realistic flow rate (1000 tokens/second)
      const largeFlowRate = 1000n * 10n ** 18n

      // This should not throw or produce incorrect results
      const tokensPerDay = flowRateToTokensPerDay(largeFlowRate)
      const tokensPerDayStr = flowRateToTokensPerDayString(largeFlowRate)

      // 1000 tokens/second * 86400 seconds = 86,400,000 tokens/day
      expect(tokensPerDay).toBeCloseTo(86400000, 0)
      expect(parseFloat(tokensPerDayStr)).toBeCloseTo(86400000, 0)
    })

    it('round-trip conversion preserves values', () => {
      // Test various values for round-trip conversion
      const testValues = [1, 10, 100, 1000, 10000, 100000]

      for (const value of testValues) {
        const flowRate = tokensPerDayToFlowRate(value)
        const result = flowRateToTokensPerDay(flowRate)
        // Should be within 0.01% due to integer division
        expect(Math.abs(result - value) / value).toBeLessThan(0.0001)
      }
    })
  })
})
