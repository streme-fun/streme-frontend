---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, security, logging]
dependencies: []
---

# Sensitive Information in Console Logs

## Problem Statement

Authentication tokens and sensitive response data are logged to console in production code.

**Why it matters:** Tokens and user data could be exposed through log aggregation services or error tracking systems.

## Findings

### Location 1: Checkin Route
- **File:** `src/app/api/checkin/route.ts`
- **Lines:** 99-105

```typescript
console.log("Received token for checkin:");
console.log("- Token length:", token.length);
console.log("- Token starts with:", token.substring(0, 20) + "...");
```

### Location 2: SUP Points Route
- **File:** `src/app/api/sup/points/route.ts`
- **Lines:** 44-50, 116-119

```typescript
console.log("Raw response structure:", JSON.stringify(externalData, null, 2));
```

### Location 3: Mini-App Detection
- **File:** `src/lib/miniAppDetection.ts`
- 30+ console.log statements throughout

### Location 4: Various Hooks
Multiple hooks have extensive debug logging that runs in production.

## Proposed Solutions

### Option 1: Use conditional logging based on NODE_ENV (Recommended)
**Pros:** Quick fix, keeps debug capability
**Cons:** Must remember to use pattern
**Effort:** Low
**Risk:** Low

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log("Debug info:", data);
}
```

### Option 2: Use structured logging library (pino)
**Pros:** Proper log levels, filtering
**Cons:** Already have pino-pretty, need to use it
**Effort:** Medium
**Risk:** Low

### Option 3: Remove all console.log statements
**Pros:** Clean code
**Cons:** Lose debugging capability
**Effort:** Medium
**Risk:** Medium

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Sensitive data being logged:**
- JWT token prefixes
- API response payloads
- User identifiers
- Internal API URLs

## Acceptance Criteria

- [ ] No sensitive data logged in production
- [ ] Debug logging gated by NODE_ENV
- [ ] Structured logging for important events
- [ ] Log levels properly configured

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during security review |

## Resources

- pino logging library (already in dependencies)
