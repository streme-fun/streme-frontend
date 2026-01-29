---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, performance, blockchain]
dependencies: []
---

# Unbatched RPC Calls in Tokens Page

## Problem Statement

Balance fetching falls back to individual RPC calls instead of using multicall, and staked balance calls are individual rather than batched.

**Why it matters:** For 30 tokens, this results in 30+ RPC calls instead of 1-2 multicall operations, causing latency and potentially hitting RPC rate limits.

## Findings

### Location 1: Balance Fetching
- **File:** `src/app/tokens/page.tsx`
- **Lines:** 321-373

```typescript
const directFetchPromises = tokensNeedingDirectFetch.map(
  async (tokenAddress) => {
    try {
      const balance = await publicClient.readContract({ ... });
```

### Location 2: Staked Balance Calls
- **File:** `src/app/tokens/page.tsx`
- **Lines:** 854-891

```typescript
const stakedBalancePromises = batch.map(async (stake, index) => {
  // ... individual publicClient.readContract call
});
```

### Existing Solution Available
The codebase has `batchBalanceOf` method in `src/lib/viemClient.ts` via requestBatcher.

## Proposed Solutions

### Option 1: Use existing batchBalanceOf (Recommended)
**Pros:** Already implemented, uses multicall
**Cons:** None
**Effort:** Low
**Risk:** Low

```typescript
const balances = await requestBatcher.batchBalanceOf(
  tokenAddresses.map(addr => ({
    address: effectiveAddress,
    tokenAddress: addr
  }))
);
```

### Option 2: Implement multicall for staked balances
**Pros:** Even more efficient
**Cons:** More code
**Effort:** Medium
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Current:** O(n) RPC calls where n = tokens (30-50 typically)
**After fix:** O(1) or O(n/batch_size) RPC calls

**Performance Impact:**
- Current: 30 calls × 100ms = 3 seconds
- After: 2 calls × 100ms = 200ms

## Acceptance Criteria

- [ ] Balance fetching uses batchBalanceOf
- [ ] Staked balances use multicall
- [ ] RPC call count reduced by 90%
- [ ] Error handling maintained for individual failures

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during performance review |

## Resources

- Existing: `src/lib/viemClient.ts:requestBatcher`
- [viem multicall](https://viem.sh/docs/contract/multicall)
