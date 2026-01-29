---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, performance, api]
dependencies: []
---

# N+1 Query Pattern in TokenGrid Enrichment

## Problem Statement

The `enrichFirstPageTrending` and `enrichTokenBatch` functions make individual API calls per token rather than batching. For 36 tokens per page, this results in 36 separate API calls.

**Why it matters:** Creates significant latency and server load at scale. Users experience slow page loads and the backend handles unnecessary request volume.

## Findings

### Location
- **File:** `src/components/TokenGrid.tsx`
- **Lines:** 866-954, 972-1001

### Evidence
```typescript
const enrichedBatch = await Promise.all(
  batch.map(async (token) => {
    try {
      const { totalStreamed, totalStakers } = await calculateRewards(
        token.created_at,
        token.contract_address,
        token.staking_pool
      );
```

### Impact
- 36+ API calls per page load instead of 1-2
- ~200-500ms latency per call = 7-18 seconds total potential latency
- Server load scales linearly with tokens displayed

### Existing Solution Available
The codebase already has `calculateBatchRewards` in `src/lib/rewards.ts` which supports batch queries but isn't being used.

## Proposed Solutions

### Option 1: Use existing calculateBatchRewards (Recommended)
**Pros:** Already implemented, minimal code change
**Cons:** None
**Effort:** Low
**Risk:** Low

```typescript
const batchResults = await calculateBatchRewards(
  batch.map(t => ({ stakingPool: t.staking_pool }))
);
```

### Option 2: Implement server-side batching API
**Pros:** Even more efficient
**Cons:** More work, API changes
**Effort:** High
**Risk:** Medium

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/components/TokenGrid.tsx`
- `src/lib/rewards.ts` (has solution)

**Performance Impact:**
- Current: O(n) API calls where n = tokens
- After fix: O(1) or O(n/batch_size) API calls

## Acceptance Criteria

- [ ] Token enrichment uses batch API calls
- [ ] Page load time reduced by 60%+
- [ ] No increase in error rate
- [ ] Loading states still work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during performance review |

## Resources

- Existing batch function: `src/lib/rewards.ts:calculateBatchRewards`
