---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, security, api, validation]
dependencies: []
---

# Missing Input Validation on API Endpoints

## Problem Statement

Multiple API routes accept token addresses and other parameters without proper validation, passing them directly to external services.

**Why it matters:** Invalid addresses could cause unexpected behavior, potential injection in external API calls, or application errors.

## Findings

### Location 1: Gasless Submit API
- **File:** `src/app/api/gasless/submit/route.tsx`
- **Lines:** 3-16

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  // NO VALIDATION of body contents
  const res = await fetch(`https://api.0x.org/gasless/submit`, {
    body: JSON.stringify(body),  // Passes untrusted data directly
  });
```

### Location 2: Token Address Validation
- **File:** `src/app/api/tokens/single/route.ts` (line 43)
- **File:** `src/app/api/tokens/multiple/route.ts` (lines 10-12)
- **File:** `src/app/api/neynar/bulk-users-by-address/route.ts` (lines 5-7)

```typescript
const address = searchParams.get("address");
if (!address) {
  return Response.json({ error: "Address is required" }, { status: 400 });
}
// No validation that address is a valid 0x prefixed 40-char hex string
```

### Location 3: Quote API
- **File:** `src/app/api/quote/route.tsx`
- **Lines:** 3-10

Search parameters passed directly to 0x API without validation.

## Proposed Solutions

### Option 1: Use viem's isAddress() for all address inputs (Recommended)
**Pros:** Industry standard, already in dependencies
**Cons:** Need to add to all routes
**Effort:** Medium
**Risk:** Low

```typescript
import { isAddress } from 'viem';
if (!address || !isAddress(address)) {
  return Response.json({ error: "Invalid address format" }, { status: 400 });
}
```

### Option 2: Create validation middleware
**Pros:** Centralized validation
**Cons:** More complex setup
**Effort:** High
**Risk:** Low

### Option 3: Use zod schemas for API validation
**Pros:** Type-safe, comprehensive
**Cons:** New dependency pattern
**Effort:** High
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Validation Needed:**
- Ethereum addresses: `isAddress()` from viem
- Token amounts: BigInt-safe string
- Chain IDs: Enum validation
- Required fields: Presence checks

## Acceptance Criteria

- [ ] All address inputs validated with isAddress()
- [ ] Required parameters checked before use
- [ ] Informative error messages returned
- [ ] External API calls only made with valid input

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during security review |

## Resources

- [viem isAddress](https://viem.sh/docs/utilities/isAddress)
