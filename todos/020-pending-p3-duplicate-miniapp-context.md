---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, simplification, duplication]
dependencies: []
---

# Duplicate Mini-App Detection Contexts

## Problem Statement

Two different contexts exist for the same boolean (`isMiniApp`): EnvironmentProvider and MiniAppContext. Both just wrap a single boolean value.

**Why it matters:** Confusion about which to use. Extra provider nesting. 14 lines that could be removed.

## Findings

### Location 1: EnvironmentProvider
- **File:** `src/components/providers/EnvironmentProvider.tsx`
- **Lines:** 31 lines

### Location 2: MiniAppContext
- **File:** `src/contexts/MiniAppContext.tsx`
- **Lines:** 14 lines

### Usage Pattern
Some components use `useEnvironment()`, others use `useMiniApp()`. Both return essentially the same information.

## Proposed Solutions

### Option 1: Remove MiniAppContext, use only EnvironmentProvider (Recommended)
**Pros:** Single source of truth
**Cons:** Need to update imports
**Effort:** Low
**Risk:** Low

### Option 2: Keep MiniAppContext as re-export of EnvironmentContext
**Pros:** No import changes needed
**Cons:** Still maintains two files
**Effort:** Low
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**MiniAppContext is just:**
```typescript
const MiniAppContext = createContext<MiniAppContextType | undefined>(undefined);
// ... provider that sets isMiniApp boolean
```

EnvironmentProvider does the same thing with more features.

## Acceptance Criteria

- [ ] Single context for environment/mini-app detection
- [ ] All usages updated
- [ ] Duplicate file removed
- [ ] No functionality lost

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during simplicity review |

## Resources

- React context patterns
