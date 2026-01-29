---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, security, api]
dependencies: []
---

# Unauthenticated File Upload Endpoint

## Problem Statement

The image upload endpoint at `/api/upload` has no authentication. While it validates file type and size, anyone can upload images to the Cloudinary account.

**Why it matters:** Storage cost abuse, potential for hosting malicious content, could be used to distribute inappropriate material.

## Findings

### Location
- **File:** `src/app/api/upload/route.ts`
- **Lines:** 11-86

### Evidence
```typescript
export async function POST(request: NextRequest) {
  // No authentication check!
  const formData = await request.formData();
  const file = formData.get('file') as File;
```

### Mitigating Factors
- File type validation exists (images only)
- Size limits are enforced
- Cloudinary has its own moderation options

## Proposed Solutions

### Option 1: Require authentication
**Pros:** Prevents abuse
**Cons:** Breaks anonymous uploads
**Effort:** Medium
**Risk:** Low

### Option 2: Add rate limiting per IP
**Pros:** Limits abuse without breaking UX
**Cons:** Can be bypassed with multiple IPs
**Effort:** Low
**Risk:** Medium

### Option 3: Add CAPTCHA verification
**Pros:** Stops automated abuse
**Cons:** Worse UX
**Effort:** Medium
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

Current validations:
- File presence check
- Size limit (likely in Cloudinary config)
- Type validation

Missing:
- Authentication
- Rate limiting
- Abuse logging

## Acceptance Criteria

- [ ] Authentication required for uploads
- [ ] Rate limiting per user/IP
- [ ] Abuse logging implemented
- [ ] Cloudinary moderation enabled

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during security review |

## Resources

- Cloudinary moderation features
