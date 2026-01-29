---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, architecture, duplication]
dependencies: []
---

# Transaction Button Code Duplication

## Problem Statement

Transaction handling components (StakeButton, SwapButton, UnstakeButton, etc.) share nearly identical patterns for mini-app vs desktop transaction execution, error handling, and toast notifications.

**Why it matters:** ~500 lines of duplicated code across 5+ components. Bug fixes must be applied in multiple places. Inconsistencies creep in over time.

## Findings

### Affected Files
- `src/components/StakeButton.tsx` (498 lines) - Lines 145-358
- `src/components/SwapButton.tsx` (504 lines) - Lines 407-437
- `src/components/UnstakeButton.tsx` (427 lines) - Lines 191-340
- `src/components/StakeAllButton.tsx` - Lines 91-200
- `src/components/TopUpAllStakesButton.tsx` - Lines 138-158

### Duplicated Patterns

**Pattern 1: Mini-app vs Desktop Transaction Handling**
```typescript
if (isMiniApp) {
  const ethProvider = await getSafeEthereumProvider();
  txHash = await ethProvider.request({
    method: "eth_sendTransaction",
    params: [{ to, from, data, chainId: "0x2105" }],
  });
} else {
  // wagmi wallet client transaction
}
```

**Pattern 2: Divvi Referral Tagging**
All components call:
```typescript
const dataWithReferral = await appendReferralTag(data, address);
await submitDivviReferral(txHash, 8453);
```

**Pattern 3: Error Handling (50+ lines each)**
Nearly identical error extraction and toast messaging.

## Proposed Solutions

### Option 1: Create useTransaction hook (Recommended)
**Pros:** Single source of truth, testable, maintainable
**Cons:** Refactoring effort
**Effort:** Medium
**Risk:** Low

```typescript
const { sendTransaction, waitForReceipt } = useTransaction();
```

### Option 2: Create TransactionExecutor utility class
**Pros:** Can be used outside React components
**Cons:** Less React-idiomatic
**Effort:** Medium
**Risk:** Low

### Option 3: Higher-order component for transaction buttons
**Pros:** Shared UI logic too
**Cons:** HOCs are less favored in modern React
**Effort:** Medium
**Risk:** Medium

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Estimated LOC reduction:** 350-400 lines

**New abstraction should handle:**
- Provider acquisition (mini-app vs wagmi)
- Chain ID enforcement
- Referral tag appending
- Receipt waiting
- Error parsing
- Toast notifications

## Acceptance Criteria

- [ ] useTransaction hook created
- [ ] All transaction components refactored to use hook
- [ ] Error handling consistent across all buttons
- [ ] Tests cover mini-app and desktop paths

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during pattern analysis |

## Resources

- Pattern: `src/components/StakeButton.tsx` (reference implementation)
