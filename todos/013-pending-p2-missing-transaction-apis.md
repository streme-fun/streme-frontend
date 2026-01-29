---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, agent-native, api]
dependencies: []
---

# No Transaction Execution APIs for Agent Access

## Problem Statement

All 15+ transactional features (swap, stake, unstake, stream management, etc.) are tightly coupled to UI components and wallet connections with no programmatic API endpoints.

**Why it matters:** Agents cannot execute any trading, staking, or streaming actions. The platform is not agent-native.

## Findings

### UI-Only Transactional Features
| Feature | Component | API Endpoint |
|---------|-----------|-------------|
| Execute swap | SwapButton.tsx | NONE |
| Stake tokens | StakeButton.tsx | NONE |
| Unstake tokens | UnstakeButton.tsx | NONE |
| Claim LP fees | ClaimFeesButton.tsx | NONE |
| Buy & Stake (Zap) | ZapStakeButton.tsx | NONE |
| Top up stakes | TopUpAllStakesButton.tsx | NONE |
| Connect to pool | ConnectPoolButton.tsx | NONE |
| Claim vault | ClaimVaultButton.tsx | NONE |
| Create CFA stream | /cfa page | NONE |
| Delete CFA stream | /cfa page | NONE |
| Launch token | LaunchTokenModal.tsx | NONE (Farcaster mention only) |
| Crowdfund contribute | ContributionModal.tsx | NONE |

### Agent-Native Score
- 5/20+ capabilities are agent-accessible (read-only operations)
- 0/15 transactional capabilities have API equivalents

## Proposed Solutions

### Option 1: Add Transaction Data Building APIs (Recommended)
**Pros:** Secure (agents sign their own txs), comprehensive
**Cons:** Significant development effort
**Effort:** High
**Risk:** Low

Create endpoints that return unsigned transaction data:
- `POST /api/swap/build` - Returns swap transaction data
- `POST /api/stake/build` - Returns stake transaction data
- `POST /api/stream/create/build` - Returns CFA stream creation data
- `POST /api/stream/delete/build` - Returns CFA stream deletion data

### Option 2: Add signed transaction submission APIs
**Pros:** Full automation possible
**Cons:** Security complexity, key management
**Effort:** Very High
**Risk:** High

### Option 3: Document existing workarounds
**Pros:** No development
**Cons:** Doesn't fix the problem
**Effort:** Low
**Risk:** High (agents still blocked)

## Recommended Action
<!-- To be filled during triage -->

## Technical Details

**Transaction Data API Pattern:**
```typescript
// POST /api/stake/build
{
  tokenAddress: "0x...",
  amount: "1000000000000000000",
  userAddress: "0x..."
}

// Response
{
  to: "0x...",
  data: "0x...",
  value: "0",
  chainId: 8453
}
```

## Acceptance Criteria

- [ ] Transaction building APIs for swap, stake, unstake
- [ ] Stream management APIs created
- [ ] API documentation (OpenAPI spec)
- [ ] Agent can complete full staking flow programmatically

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created finding | Discovered during agent-native review |

## Resources

- 0x API pattern for swap building
