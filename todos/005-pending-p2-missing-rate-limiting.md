---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, security, api]
dependencies: []
---

# Missing Rate Limiting on All API Endpoints

## Problem Statement

None of the API routes implement rate limiting. This makes the application vulnerable to denial of service attacks, API key exhaustion, and brute force attacks.

**Why it matters:** An attacker could exhaust paid API quotas (0x, Neynar, Typesense), cause service degradation, or brute force authentication endpoints.

## Findings

### Location
All files in `src/app/api/`

### Most Critical Routes Without Rate Limiting
- `/api/auth/verify-siwf` - Authentication endpoint
- `/api/checkin` - Authenticated actions
- `/api/quote` - Uses 0x API key
- `/api/gasless/*` - Uses 0x API key
- `/api/neynar/*` - Uses Neynar API key
- `/api/search` - Uses Typesense API key

### Impact
- DoS vulnerability
- API key quota exhaustion (paid services)
- Brute force attack vulnerability

## Proposed Solutions

### Option 1: Implement @upstash/ratelimit (Recommended)
**Pros:** Serverless-friendly, easy setup, Redis-based
**Cons:** Requires Upstash account
**Effort:** Medium
**Risk:** Low

### Option 2: Use Vercel Edge Config rate limiting
**Pros:** Native to deployment platform
**Cons:** Vercel-specific
**Effort:** Medium
**Risk:** Low

### Option 3: Implement in-memory rate limiting
**Pros:** No external dependencies
**Cons:** Doesn't work across serverless instances
**Effort:** Low
**Risk:** Medium (limited effectiveness)

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Suggested Limits:**
- Authentication: 10 req/min per IP
- Swap quotes: 30 req/min per user
- Search: 60 req/min per user
- General reads: 100 req/min per IP

## Acceptance Criteria

- [ ] Rate limiting middleware implemented
- [ ] Appropriate limits per endpoint type
- [ ] 429 responses with Retry-After header
- [ ] Rate limit headers exposed (X-RateLimit-*)
- [ ] Monitoring for rate limit hits

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during security review |

## Resources

- [@upstash/ratelimit](https://github.com/upstash/ratelimit)
