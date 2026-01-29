---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, performance, react]
dependencies: []
---

# Frequent Re-renders from 30fps Animation

## Problem Statement

The streaming number hook updates state every 33ms (30fps), causing potential re-renders 30 times per second for every streaming balance component.

**Why it matters:** With multiple tokens displayed, this compounds severely, causing high CPU usage, battery drain on mobile, and janky UI.

## Findings

### Location
- **File:** `src/hooks/useStreamingNumber.ts`
- **Lines:** 12-124

### Evidence
```typescript
updateInterval = 33, // ~30fps for smoother animations
```

```typescript
setStreamedAmount((prev) => {
  const diff = Math.abs(newStreamed - prev);
  return diff > 0.001 ? newStreamed : prev;
});
```

### Impact
- Every streaming balance triggers 30 potential re-renders/second
- With 36 tokens on page: up to 1,080 state updates/second
- High CPU usage
- Battery drain on mobile devices

## Proposed Solutions

### Option 1: Increase update interval to 100-150ms (Quick Fix)
**Pros:** Minimal change, significant improvement
**Cons:** Slightly less smooth animation
**Effort:** Low
**Risk:** Low

### Option 2: Use CSS animations with transform
**Pros:** GPU-accelerated, no React re-renders
**Cons:** More complex implementation
**Effort:** High
**Risk:** Medium

### Option 3: Use requestAnimationFrame with useDeferredValue
**Pros:** Browser-optimized timing
**Cons:** React 18+ only
**Effort:** Medium
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Current:** 33ms interval = 30 updates/second
**Proposed:** 150ms interval = 6-7 updates/second (sufficient for visual smoothness)

## Acceptance Criteria

- [ ] Update interval increased to 100-150ms
- [ ] Animation still appears smooth visually
- [ ] CPU usage reduced by 70%+
- [ ] Mobile battery impact reduced

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during performance review |

## Resources

- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [useDeferredValue](https://react.dev/reference/react/useDeferredValue)
