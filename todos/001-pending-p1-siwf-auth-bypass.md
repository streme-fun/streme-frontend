---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, authentication]
dependencies: []
---

# SIWF Authentication Bypass Vulnerability

## Problem Statement

The Sign-In with Farcaster (SIWF) verification endpoint does NOT actually verify the cryptographic signature. The code only extracts the FID and address from the message using regex patterns without validating the signature, allowing attackers to forge authentication tokens.

**Why it matters:** An attacker can impersonate any Farcaster user by crafting a message containing their target's FID and address, completely bypassing authentication. This is a critical security vulnerability that could lead to account takeover.

## Findings

### Location
- **File:** `src/app/api/auth/verify-siwf/route.ts`
- **Lines:** 42-67, 84-95

### Evidence
```typescript
// Simple message parsing to extract FID and address
// In production, use proper @farcaster/auth-kit verification  <-- The comment acknowledges this is insecure!
const fidMatch = message.match(/fid:(\d+)/);
const addressMatch = message.match(/(0x[a-fA-F0-9]{40})/);
```

The session token generation is also insecure:
```typescript
// Generate a simple session token (in production, use proper JWT)
function generateSessionToken(fid: number, address: string): string {
  const payload = {...};
  // Simple base64 encoding (NOT secure for production)
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
```

### Impact
- Complete authentication bypass
- User impersonation possible
- Session tokens can be forged

## Proposed Solutions

### Option 1: Implement proper @farcaster/auth-kit verification (Recommended)
**Pros:** Industry standard, cryptographically secure, maintained by Farcaster team
**Cons:** Requires dependency addition
**Effort:** Medium
**Risk:** Low

### Option 2: Use proper JWT with HMAC/RSA signing
**Pros:** Standard approach, well-documented
**Cons:** More implementation work
**Effort:** Medium
**Risk:** Low

### Option 3: Validate nonce against server-side store
**Pros:** Prevents replay attacks
**Cons:** Requires additional infrastructure (Redis/DB)
**Effort:** High
**Risk:** Medium

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/app/api/auth/verify-siwf/route.ts`

**Components:**
- Authentication system
- Session management

## Acceptance Criteria

- [ ] Signature verification implemented using @farcaster/auth-kit
- [ ] JWT tokens use proper HMAC/RSA signing
- [ ] Nonce validation prevents replay attacks
- [ ] Unit tests cover authentication edge cases
- [ ] Security audit passed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during security review |

## Resources

- [Farcaster Auth Kit](https://docs.farcaster.xyz/auth-kit)
- PR: N/A (full codebase review)
