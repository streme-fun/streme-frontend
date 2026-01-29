---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, simplification, maintenance]
dependencies: []
---

# Dead Code in ClientLayout.tsx

## Problem Statement

ClientLayout.tsx contains ~350 lines of dead/disabled code for features that have been turned off but not removed, creating maintenance burden and confusion.

**Why it matters:** 763 line file with ~45% dead code. Developers must understand what's active vs disabled. Risk of accidentally re-enabling broken features.

## Findings

### Location
- **File:** `src/app/ClientLayout.tsx`
- **Total Lines:** 763
- **Dead Code Lines:** ~350

### Dead Code Inventory

| Lines | Description |
|-------|-------------|
| 100-125 | Unused `UnstakedToken` interface and `fetchNeynarUser` function |
| 137-138, 492-493, 614-624 | Commented-out `unstakedTokens` state and modal |
| 154-155 | `showTutorialModal` state that's never used |
| 250-258 | `safeToLowerCase` callback wrapping a one-liner |
| 260-298 | `fetchTokenData` callback used only for disabled feature |
| 301-508 | 200+ lines for unstaked tokens check - COMPLETELY DEAD |
| 549-567 | Handlers for disabled tutorial: `handleTutorialClick`, `handleCloseTutorial`, `handleSkipTutorial` |
| 587-591 | Commented-out tutorial modal JSX |

### Pattern
Features were disabled by commenting rather than removal, creating maintenance burden.

## Proposed Solutions

### Option 1: Remove all dead code (Recommended)
**Pros:** Clean codebase, clear what's active
**Cons:** Features need re-implementation if wanted later
**Effort:** Low
**Risk:** Low

### Option 2: Extract to feature flags
**Pros:** Easy to re-enable
**Cons:** Still maintaining unused code
**Effort:** Medium
**Risk:** Low

### Option 3: Move to separate files with clear "disabled" naming
**Pros:** Preserves code for reference
**Cons:** Still clutters repo
**Effort:** Low
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Files to update:**
- `src/app/ClientLayout.tsx` - Remove dead code
- `src/app/app.tsx` - Also has 100+ lines of commented checkin code

## Acceptance Criteria

- [ ] All commented-out code removed
- [ ] Unused interfaces and functions removed
- [ ] File size reduced by ~350 lines
- [ ] All remaining code is active and tested

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during simplicity review |

## Resources

- Git history preserves removed code if needed later
