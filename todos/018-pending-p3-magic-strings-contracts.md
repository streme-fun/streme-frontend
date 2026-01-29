---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, maintenance, duplication]
dependencies: []
---

# Magic Strings: Contract Addresses Scattered Across Files

## Problem Statement

The same contract address `0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58` (STREME token) appears in 8+ different files as hardcoded strings.

**Why it matters:** If this address needs to change, all files must be updated. Risk of inconsistency. Hard to audit all contract references.

## Findings

### Locations
| File | Lines | Constant |
|------|-------|----------|
| `src/components/StakeButton.tsx` | 20-22 | GDA_FORWARDER, STAKING_HELPER |
| `src/components/StakeAllButton.tsx` | 15-17 | Same constants |
| `src/components/SwapButton.tsx` | 7, 242, 255 | USDC, ETH addresses |
| `src/components/StreamingBalance.tsx` | 10-11 | STREME_TOKEN_ADDRESS, STREME_STAKING_POOL |
| `src/components/CheckinModal.tsx` | 48-49 | Same addresses |
| `src/components/CheckinSuccessModal.tsx` | 52-53 | Same addresses |
| `src/components/TopUpAllStakesButton.tsx` | 17-18 | STAKING_MACRO_V2, MACRO_FORWARDER |
| `src/components/UnstakedTokensModal.tsx` | 38 | MACRO_FORWARDER |

### Pattern
Constants are defined locally in each file rather than imported from a central location.

## Proposed Solutions

### Option 1: Consolidate all addresses in contracts.ts (Recommended)
**Pros:** Single source of truth, easy to audit
**Cons:** Need to update all imports
**Effort:** Medium
**Risk:** Low

### Option 2: Use environment variables
**Pros:** Can change without rebuild
**Cons:** Adds complexity
**Effort:** Medium
**Risk:** Medium

### Option 3: Create contract registry with types
**Pros:** Type-safe, documented
**Cons:** More setup
**Effort:** High
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Existing central file:** `src/lib/contracts.ts` already exists but isn't used consistently.

**Proposed additions to contracts.ts:**
```typescript
export const CONTRACTS = {
  STREME_TOKEN: "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as Address,
  STREME_STAKING_POOL: "0xa040a8564c433970d7919c441104b1d25b9eaa1c" as Address,
  STAKING_HELPER: "0x1738e0Fed480b04968A3B7b14086EAF4fDB685A3" as Address,
  GDA_FORWARDER: "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08" as Address,
  // ... etc
} as const;
```

## Acceptance Criteria

- [ ] All contract addresses defined in contracts.ts
- [ ] All components import from contracts.ts
- [ ] No hardcoded addresses in component files
- [ ] Types ensure address format

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during pattern analysis |

## Resources

- Existing: `src/lib/contracts.ts`
- CLAUDE.md lists all contract addresses
