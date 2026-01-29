---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, security, xss]
dependencies: []
---

# Dangerous CSP Directives: unsafe-eval and unsafe-inline

## Problem Statement

The Content Security Policy allows `'unsafe-eval'` and `'unsafe-inline'` for scripts, significantly weakening XSS protection.

**Why it matters:** An attacker who can inject content could execute arbitrary JavaScript, bypassing CSP protections.

## Findings

### Location
- **File:** `src/app/next.config.js`
- **Lines:** 113-116

### Evidence
```javascript
script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com...
```

## Proposed Solutions

### Option 1: Remove unsafe-eval, use nonces for inline scripts (Recommended)
**Pros:** Maintains security while allowing necessary inline scripts
**Cons:** Requires nonce implementation
**Effort:** Medium
**Risk:** Medium (may break some features)

### Option 2: Use hashes for inline scripts
**Pros:** More secure than unsafe-inline
**Cons:** Must update hashes when scripts change
**Effort:** Medium
**Risk:** Low

### Option 3: Move inline scripts to external files
**Pros:** Eliminates need for unsafe-inline entirely
**Cons:** Additional network requests
**Effort:** High
**Risk:** Low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

The inline scripts in `src/app/layout.tsx` (lines 34-61) are for:
- Theme initialization
- Eruda debugging console

Both could be moved to external files or use nonces.

## Acceptance Criteria

- [ ] unsafe-eval removed from CSP
- [ ] unsafe-inline replaced with nonces or hashes
- [ ] All legitimate scripts still work
- [ ] CSP report-only mode tested first

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during security review |

## Resources

- [CSP Nonces](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)
