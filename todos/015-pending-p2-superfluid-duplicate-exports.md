---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, duplication, maintenance]
dependencies: []
---

# Superfluid Duplicate Exports Across Files

## Problem Statement

The same constants and functions are exported from multiple Superfluid-related files, creating confusion about which to import and risk of inconsistency.

**Why it matters:** Same constant defined 3 times could drift. Developers don't know which file to import from. ~80 lines of duplicated code.

## Findings

### Duplicate Constants
`STREME_SUPER_TOKEN` defined identically in 3 files:
- `src/lib/superfluid-cfa.ts` (line 6-7)
- `src/lib/superfluid-streaming.ts` (line 6-7)
- `src/lib/superfluid-pools.ts` (line 6-7)

### Duplicate Functions
| Function | File 1 | File 2 |
|----------|--------|--------|
| `tokensPerDayToFlowRate` | superfluid-cfa.ts:186 | superfluid-streaming.ts:47 |
| `flowRateToTokensPerDay` | superfluid-cfa.ts:195 | superfluid-streaming.ts:55 |
| `getBestFriendAddress` | superfluid-streaming.ts:99 | superfluid-pools.ts:148 |

## Proposed Solutions

### Option 1: Consolidate into single superfluid.ts (Recommended)
**Pros:** Single source of truth, clear imports
**Cons:** Larger single file
**Effort:** Medium
**Risk:** Low

### Option 2: Create superfluid/index.ts that re-exports
**Pros:** Maintains file separation
**Cons:** Still has duplicates internally
**Effort:** Low
**Risk:** Low

### Option 3: Create shared constants.ts, keep function files separate
**Pros:** Logical separation
**Cons:** More files to manage
**Effort:** Medium
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Proposed structure:**
```
src/lib/superfluid/
  index.ts        # Re-exports all
  constants.ts    # STREME_SUPER_TOKEN, etc.
  cfa.ts          # CFA-specific
  gda.ts          # GDA-specific (renamed from pools)
  utils.ts        # Shared utilities
```

## Acceptance Criteria

- [ ] Single definition of each constant
- [ ] Single definition of each utility function
- [ ] Clear import paths
- [ ] All usages updated to new imports

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during pattern analysis |

## Resources

- TypeScript barrel exports pattern
