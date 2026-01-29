---
status: pending
priority: p3
issue_id: "019"
tags: [code-review, api, performance]
dependencies: []
---

# Missing Pagination and Limit Validation in APIs

## Problem Statement

Some API endpoints lack pagination or have no upper bound on limit parameters, allowing requests for unbounded data.

**Why it matters:** An attacker could request `limit=999999` causing memory/performance issues. Popular tokens could have thousands of stakers returned in a single request.

## Findings

### Location 1: Stakers API - No Pagination
- **File:** `src/app/api/token/[tokenAddress]/stakers/route.ts`
- **Lines:** 1-55

Returns all stakers without pagination:
```typescript
const response = await fetch(apiUrl.toString(), { ... });
const data = await response.json();
return Response.json(data, { ... }); // All data, no limit
```

### Location 2: Tokens Route - No Limit Validation
- **File:** `src/app/api/tokens/route.ts`
- **Lines:** 11-12

```typescript
const limit = parseInt(searchParams.get("limit") || "200");
// No upper bound! Compare to sorted route which limits: Math.min(..., 100)
```

## Proposed Solutions

### Option 1: Add limit validation and pagination (Recommended)
**Pros:** Standard API practice, protects server
**Cons:** Breaking change for clients expecting all data
**Effort:** Medium
**Risk:** Low

```typescript
const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
const offset = parseInt(searchParams.get('offset') || '0');
```

### Option 2: Add cursor-based pagination
**Pros:** Better for large datasets
**Cons:** More complex
**Effort:** High
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Suggested limits:**
- Tokens: max 100 per request
- Stakers: max 100 per request
- Search results: max 50 per request

**Response should include:**
```typescript
{
  data: [...],
  pagination: {
    limit: 100,
    offset: 0,
    total: 1234,
    hasMore: true
  }
}
```

## Acceptance Criteria

- [ ] All list endpoints have max limit enforced
- [ ] Pagination parameters supported
- [ ] Total count returned for planning
- [ ] Documentation updated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during data integrity review |

## Resources

- REST API pagination best practices
