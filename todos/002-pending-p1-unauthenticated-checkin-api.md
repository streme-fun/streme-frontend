---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security, api, privacy]
dependencies: []
---

# Unauthenticated API Exposing User Check-in Data

## Problem Statement

The endpoint `/api/checkin/[fid]` allows anyone to fetch check-in history for any Farcaster user by simply providing their FID. There is no authentication check.

**Why it matters:** Exposes user activity data (total check-ins, streak counts, drop history with transaction hashes) without authorization, enabling privacy violations and potential targeted attacks.

## Findings

### Location
- **File:** `src/app/api/checkin/[fid]/route.ts`
- **Lines:** 16-57

### Evidence
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  // Validate FID - but NO authentication!
  if (!fid || isNaN(parseInt(fid))) {
    return NextResponse.json({ error: "Invalid FID" }, { status: 400 });
  }

  // Forward the request to the external API - no auth headers!
  const response = await fetch(`https://api.streme.fun/api/checkin/${fid}`, {...});
```

### Impact
- Privacy violation - any user's check-in history is publicly accessible
- Transaction hash exposure could be used for targeted analysis
- Streak and activity data could be used for social engineering

## Proposed Solutions

### Option 1: Require authentication and validate user can only access own data
**Pros:** Proper security, maintains privacy
**Cons:** Breaking change for any current consumers
**Effort:** Medium
**Risk:** Low

### Option 2: Mark endpoint as explicitly public with rate limiting
**Pros:** If data is intentionally public, document it
**Cons:** Still exposes user data
**Effort:** Low
**Risk:** Medium (privacy concerns remain)

### Option 3: Remove sensitive fields from unauthenticated response
**Pros:** Balance between utility and privacy
**Cons:** May break dependent features
**Effort:** Medium
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/app/api/checkin/[fid]/route.ts`

**Data Exposed:**
- Total check-ins count
- Current streak
- Drop history with transaction hashes
- Timestamps of activity

## Acceptance Criteria

- [ ] Authentication required to access check-in data
- [ ] Users can only access their own check-in history
- [ ] Rate limiting implemented
- [ ] Documentation updated if intentionally public

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during security review |

## Resources

- Related: Issue #001 (SIWF auth)
