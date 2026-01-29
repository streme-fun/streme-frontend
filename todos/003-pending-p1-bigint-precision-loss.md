---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, data-integrity, blockchain, financial]
dependencies: []
---

# BigInt/Number Precision Loss in Flow Rate Calculations

## Problem Statement

Multiple functions convert between BigInt and Number when handling Superfluid flow rates, causing precision loss for values exceeding `Number.MAX_SAFE_INTEGER` (2^53 - 1). Given flow rates in wei (1e18), this is problematic for amounts exceeding ~9 tokens per second.

**Why it matters:** Users could see incorrect streaming balances, and actual streamed amounts could differ from displayed values. For high-value streams, cumulative drift could be significant financial loss.

## Findings

### Location 1
- **File:** `src/lib/superfluid-streaming.ts`
- **Lines:** 47-58

```typescript
export function tokensPerDayToFlowRate(tokensPerDay: number): bigint {
  const tokensPerSecond = tokensPerDay / (24 * 60 * 60);
  return BigInt(Math.floor(tokensPerSecond * 1e18)); // Math.floor introduces rounding error
}

export function flowRateToTokensPerDay(flowRate: bigint): number {
  const tokensPerSecond = Number(flowRate) / 1e18; // Number() loses precision for large values
  return tokensPerSecond * 24 * 60 * 60;
}
```

### Location 2
- **File:** `src/lib/superfluid-streaming.ts`
- **Lines:** 69-76

```typescript
export async function getAccountFlowRate(account: Address): Promise<bigint> {
  try {
    const flowRate = await publicClient.readContract({...});
    return BigInt(Math.abs(Number(flowRate))); // BigInt→Number→BigInt loses precision
  } catch (error) {
    return BigInt(0);
  }
}
```

### Location 3
- **File:** `src/lib/superfluid-pools.ts`
- **Lines:** 164-173

```typescript
export function calculateWeeklyAmount(dailyFlowRate: string): bigint {
  const dailyAmount = parseFloat(dailyFlowRate);  // Float precision loss
  const weeklyAmount = dailyAmount * 7;
  return BigInt(Math.floor(weeklyAmount * 1e18)); // Compounds precision error
}
```

## Proposed Solutions

### Option 1: Use viem's built-in formatters (Recommended)
**Pros:** Battle-tested, handles all edge cases
**Cons:** Slight API change
**Effort:** Medium
**Risk:** Low

```typescript
import { formatUnits, parseUnits } from 'viem';

export function flowRateToTokensPerDay(flowRate: bigint): string {
  const perSecond = formatUnits(flowRate, 18);
  return (parseFloat(perSecond) * 86400).toString();
}
```

### Option 2: Use BigInt arithmetic throughout
**Pros:** No precision loss
**Cons:** More complex code
**Effort:** High
**Risk:** Low

### Option 3: Use decimal.js library
**Pros:** Arbitrary precision
**Cons:** New dependency, larger bundle
**Effort:** Medium
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/lib/superfluid-streaming.ts`
- `src/lib/superfluid-pools.ts`
- `src/lib/rewards.ts`

**Risk Threshold:**
- Number.MAX_SAFE_INTEGER = 9,007,199,254,740,991
- At 1e18 wei per token, precision loss starts at ~9 tokens per second
- For 100 tokens/day streams, accumulated error could be ~0.001% per day

## Acceptance Criteria

- [ ] All flow rate calculations use BigInt or proper decimal libraries
- [ ] No Number() conversions for values that could exceed MAX_SAFE_INTEGER
- [ ] Unit tests verify precision for large values
- [ ] Streaming balance displays match on-chain values

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during data integrity review |

## Resources

- [viem formatUnits](https://viem.sh/docs/utilities/formatUnits)
- [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
