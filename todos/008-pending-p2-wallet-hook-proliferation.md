---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, architecture, simplification]
dependencies: []
---

# Wallet Hook Proliferation

## Problem Statement

Four separate hooks handle wallet connection with significant overlap: useWallet, useUnifiedWallet, useSafeWallet, and useWalletSync. This creates confusion, maintenance burden, and potential inconsistencies.

**Why it matters:** ~660 lines of code could be ~100 lines. Multiple hooks doing the same thing differently leads to bugs and confusion about which to use.

## Findings

### Affected Files
- `src/hooks/useWallet.ts` (61 lines)
- `src/hooks/useUnifiedWallet.ts` (164 lines)
- `src/hooks/useSafeWallet.ts` (84 lines)
- `src/hooks/useWalletSync.ts` (351 lines)

### Specific Issues

**useUnifiedWallet** maintains THREE state variables for one address:
```typescript
stableAddress, lastValidAddress, rawAddress
```

**useWalletSync.ts** (lines 104-350) has:
- 7 refs
- Complex caching with MIN_REQUEST_INTERVAL, CACHE_DURATION
- Polling every 10 seconds
- PLUS an accountsChanged listener doing the same thing

### All four hooks ultimately just need:
- `address`
- `isConnected`
- `connect`
- `disconnect`

## Proposed Solutions

### Option 1: Consolidate into single useWallet (Recommended)
**Pros:** Single source of truth, simpler mental model
**Cons:** Significant refactoring
**Effort:** High
**Risk:** Medium

The single hook should:
- Return `{ address, isConnected, connect, disconnect, isMiniApp }`
- Use wagmi's built-in reactivity (no manual polling/caching)
- Trust the `accountsChanged` event (remove 10-second polling)

### Option 2: Keep useWallet and useUnifiedWallet, remove others
**Pros:** Less disruptive
**Cons:** Still has some duplication
**Effort:** Medium
**Risk:** Low

### Option 3: Document when to use each hook
**Pros:** No code changes
**Cons:** Doesn't fix underlying complexity
**Effort:** Low
**Risk:** High (tech debt remains)

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Estimated LOC reduction:** ~560 lines (660 → ~100)

## Acceptance Criteria

- [ ] Single useWallet hook handles all cases
- [ ] No manual polling for address changes
- [ ] Mini-app vs desktop detection integrated
- [ ] All components migrated to new hook
- [ ] Tests cover both environments

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during simplicity review |

## Resources

- wagmi docs on wallet connection
