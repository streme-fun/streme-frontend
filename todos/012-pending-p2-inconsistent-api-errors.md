---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, architecture, api]
dependencies: []
---

# Inconsistent API Error Response Formats

## Problem Statement

API routes return errors in different formats, making client-side error handling inconsistent and agent integration difficult.

**Why it matters:** Clients must handle multiple error formats. Debugging is harder. Automated systems can't reliably parse errors.

## Findings

### Format 1: `src/app/api/tokens/route.ts`
```typescript
return Response.json(
  {
    error: "Failed to fetch tokens",
    details: error instanceof Error ? error.message : undefined,
  },
  { status: 500 }
);
```

### Format 2: `src/app/api/neynar/user/[fid]/route.ts`
```typescript
return NextResponse.json(
  { error: "Failed to fetch user data" },
  { status: 500 }
);
```

### Format 3: `src/app/api/checkin/route.ts`
```typescript
return NextResponse.json(
  {
    success: false,
    error: "Internal server error",
    details: error instanceof Error ? error.message : "Unknown error",
  },
  { status: 500 }
);
```

### Format 4: `src/app/api/sup/points/route.ts` (lines 100-107)
```typescript
return NextResponse.json({
  error: `External API error: ${response.status}`,
  details: responseText,
  apiUrl: externalApiUrl,  // Leaks internal API URL!
}, { status: response.status });
```

## Proposed Solutions

### Option 1: Create standardized error utility (Recommended)
**Pros:** Consistent format, easy to use
**Cons:** Refactoring all routes
**Effort:** Medium
**Risk:** Low

```typescript
// lib/apiErrors.ts
export function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: code || 'UNKNOWN_ERROR',
      ...(process.env.NODE_ENV === 'development' ? { details } : {})
    },
    { status }
  );
}
```

### Option 2: Use standard error codes enum
**Pros:** Machine-readable errors
**Cons:** More setup
**Effort:** Medium
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Standard format should be:**
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

## Acceptance Criteria

- [ ] Error utility created
- [ ] All API routes use standard format
- [ ] Internal details hidden in production
- [ ] Error codes documented

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during architecture review |

## Resources

- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
