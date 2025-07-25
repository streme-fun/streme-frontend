# Project Overview

Streme.fun is a Farcaster-integrated DeFi platform for launching and trading tokens with streaming rewards on Base L2. The platform leverages Superfluid Protocol for real-time token streaming through both Constant Flow Agreements (CFA) for individual streams and General Distribution Agreements (GDA) for group distributions.

# Tech Stack

- Framework: Next.js 15 (App Router) + TypeScript
- Blockchain: Base L2, wagmi + viem
- Styling: TailwindCSS + DaisyUI
- Auth: Privy (desktop/mobile) + wagmi (Farcaster mini-app)
- APIs: 0x Protocol (gasless swaps), Neynar (Farcaster data)

# Project Structure

```
src/
├── app/          # Next.js pages and API routes
├── components/   # React components
├── hooks/        # Custom hooks (especially useTokenData)
└── lib/          # Utilities, contracts, API helpers
```

# Main Application Pages

- `/` - Token discovery and trading
- `/launch` - Launch new tokens
- `/tokens` - User's token portfolio
- `/token/[address]` - Individual token page
- `/cfa` - Individual streaming (Constant Flow Agreements)
- `/gda` - Group distributions (General Distribution Agreements)
- `/leaderboard` - SUP points leaderboard
- `/crowdfund` - Crowdfunding campaigns

# Key Smart Contracts

- LP Factory: `0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8`
- Superfluid Host: `0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74`
- CFA V1: `0x19ba78B9cDB05A877718841c574325fdB53601bb`
- CFA V1 Forwarder: `0xcfA132E353cB4E398080B9700609bb008eceB125`
- GDA V1 Forwarder: `0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08`
- STREME Super Token: `0x3B3Cd21242BA44e9865B066e5EF5d1cC1030CC58`
- STREME Staking Pool: `0xcbc2caf425f8cdca774128b3d14de37f2224b964`
- STREME Staking Rewards Funder: (Address in useStremeStakingContract)
- Macro Forwarder: `0xFD0268E33111565dE546af2675351A4b1587F89F`
- Staking Macro V2: `0x5c4b8561363E80EE458D3F0f4F14eC671e1F54Af`
- Fluid Locker Factory: `0xa6694cab43713287f7735dadc940b555db9d39d9`

# Core Patterns

- Token data managed via `useTokenData` context (centralized balance management)
- API routes follow `/api/[resource]/[action]` pattern
- All addresses lowercase in API calls and subgraph queries
- Token amounts use BigInt for contract interactions
- Timestamps use Firestore format (`_seconds`, `_nanoseconds`) for Firebase data
- Superfluid flow rates are in wei/second, convert using `flowRateToTokensPerDay()`
- Real-time animations use `useStreamingNumber` hook
- Farcaster user data fetched via Neynar API
- Safe image loading with fallback using `SafeImage` component

# Key Hooks

- `useTokenData` - Centralized token balance management
- `useAppFrameLogic` - Farcaster mini-app detection and context
- `useStremeBalance` - User's STREME token balance
- `useStremeFlowRate` - User's STREME staking rewards flow rate
- `useCFAFlowRate` - User's net CFA flow rate (incoming - outgoing)
- `useStreamingNumber` - Animated number display for streaming values
- `useDistributionPool` - GDA pool management
- `useCheckin` - Daily check-in functionality
- `useCheckinModal` - Check-in modal state management
- `useStremeStakingContract` - STREME staking operations (deposit, withdraw, approve)
- `useBestFriendsStreaming` - Farcaster best friends integration

# Superfluid Integration

## Subgraph Queries
- Endpoint: `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1`
- Key entities: `streams`, `pools`, `poolMembers`, `accountTokenSnapshots`
- Always use lowercase addresses in queries
- Token address must be embedded in query string, not as variable

## Flow Rate Calculations
- Flow rates stored as wei/second in contracts
- Convert to tokens/day: `flowRateToTokensPerDay(flowRate)`
- Convert from tokens/day: `tokensPerDayToFlowRate(tokensPerDay)`

## Common Issues
- Use `accountTokenSnapshots` for net flow rate, not individual streams
- Stream IDs format: `sender-receiver-token-userData`
- Extract receiver from stream ID if not in response

# UI Guidelines

- Use DaisyUI defaults for consistent theming
- Dark mode: use `base-100`, `base-200`, `base-300` instead of `gray-X`
- Loading states: use DaisyUI's `loading` classes
- Modals: use DaisyUI modal patterns with proper backdrop
- Forms: use DaisyUI form controls with proper validation states
- Avatars: use `SafeImage` component for user profile pictures
- Real-time values: use `font-mono` for numbers that update
- Success/error states: use DaisyUI alerts or toast notifications

# Authentication / Wallet Connection

- Privy handles desktop/mobile authentication, but wagmi is used for Farcaster mini-app
- Mini-app wallet isolation: Connectors are conditionally configured to prevent browser wallet interference in mini-app context

## Mini-App Wallet Connection Guidelines

**ALWAYS** reference the official Farcaster Mini-App documentation at https://miniapps.farcaster.xyz/llms-full.txt for wallet connection patterns.

### Key Principles:
1. **No Auto-Connection**: Never force wallet connections - the Farcaster Mini App connector will automatically connect if a user already has a wallet
2. **User-Initiated Connection**: Only connect when user explicitly clicks a connect button
3. **Standard Wagmi Pattern**: Use standard wagmi `connect()` with proper connector selection
4. **Respect User Choice**: Let users decide when to connect their wallet

### Correct Connection Pattern:
```tsx
function ConnectWallet() {
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()

  if (isConnected) {
    return <div>Connected: {address}</div>
  }

  const handleConnect = () => {
    const farcasterConnector = connectors.find(c => c.id === 'farcasterMiniApp')
    if (farcasterConnector) {
      connect({ connector: farcasterConnector })
    }
  }

  return <button onClick={handleConnect}>Connect Wallet</button>
}
```

### What NOT to do:
- Force auto-connection on page load
- Override user's wallet choice
- Skip the connect button for mini-app users

## Mini-App Transaction Best Practices

When implementing transactions in mini-app context (via `eth_sendTransaction`), always include:

```typescript
const txHash = await ethProvider.request({
  method: "eth_sendTransaction",
  params: [{
    to: contractAddress,
    from: userAddress,
    data: encodedData,
    chainId: "0x2105", // Base mainnet chain ID (8453 in hex) - REQUIRED
    // ... other params
  }],
});
```

**Critical**: Missing `chainId` parameter causes transactions to execute on whatever network the wallet is connected to, not Base. This affects all components that use `eth_sendTransaction` including:
- StakeButton, UnstakeButton, SwapButton
- TopUpAllStakesButton, StakeAllButton  
- ClaimFeesButton, ZapStakeButton
- ConnectPoolButton, UnstakedTokensModal
- StakerLeaderboardEmbed

# Testing

- Jest + React Testing Library
- Test files in `__tests__/`
- Mock handlers in `__tests__/utils/`
- Run specific test: `npm test -- path/to/test`

# Key Environment Variables

- `NEYNAR_API_KEY` - Farcaster API access
- `ZEROX_API_KEY` - 0x swaps

# Documentation

- **Farcaster Mini App Docs (always updated)**: https://miniapps.farcaster.xyz/llms-full.txt

# Bash Commands

- npm run check:all: Check for all errors (do this when you're done making changes)
- npm run lint: Run the linter
- npm run typecheck: Check for type errors
- npm run build: Build the project
- npm test: Run tests
- npm run dev: Start development server

# Common Development Tasks

## Adding a New Page
1. Create page in `src/app/[page-name]/page.tsx`
2. Add navigation link if needed
3. Follow existing page patterns (loading states, error handling)
4. Use proper TypeScript types

## Working with Superfluid Streams
1. Use existing hooks (`useCFAFlowRate`, `useDistributionPool`)
2. Always handle BigInt conversions properly
3. Show real-time animations with `useStreamingNumber`
4. Include proper error handling for failed transactions

## API Route Best Practices
1. Follow `/api/[resource]/[action]` pattern
2. Return consistent error responses
3. Validate input parameters
4. Handle missing environment variables gracefully

# Debug Mode Features

The app includes a debug menu (bottom-right corner) with:
- CFA Page - Individual streaming interface
- GDA Page - Group distribution interface
- Network switching
- Wallet connection info
- Performance metrics

Enable debug mode by clicking the floating button in development.

# Workflow

- Be sure to typecheck and lint when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
- Check balance call tracking in console during development
- Use existing patterns when adding features
- Update types in `/src/app/types/` when modifying data structures

# Important Notes

- `params` needs to be awaited in Next.js 15 (e.g., `const params = await props.params`)
- Images: Next.js warns about `<img>` tags, but they're acceptable for user avatars
- React Hook dependencies: Some are intentionally omitted to prevent re-render loops
- Superfluid queries: The subgraph sometimes returns incomplete data, always validate
- Flow rates: Can be negative (net outflow), handle UI accordingly
- Mini-app transactions: ALWAYS include `chainId: "0x2105"` in `eth_sendTransaction` calls
- CFA streams: Don't have automatic end dates - require manual termination or Flow Scheduler
- Mini-app detection: Use `clientFid` presence and other robust checks to prevent browser wallet interference

# Troubleshooting

## Network Issues
- **Transactions on wrong network**: Check `chainId` parameter in `eth_sendTransaction` calls
- **Mini-app wallet conflicts**: Verify conditional connector configuration in `WagmiProvider`
- **Stream not starting**: Ensure all required Superfluid contract addresses are correct

## Superfluid Issues  
- **Active streams not showing**: Use token address directly in query, not as variable
- **Incorrect flow rates**: Use `accountTokenSnapshots` for net rates, not individual streams
- **Missing receiver data**: Extract from stream ID format `sender-receiver-token-userData`

## Balance Issues
- **Streaming balance shows 0**: Use `balanceOf` instead of `realtimeBalanceOfNow` for actual balance
- **Animation not updating**: Check `useStreamingNumber` configuration and flow rate calculations

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.