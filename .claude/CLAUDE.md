# Project Overview

Streme.fun is a Farcaster-integrated DeFi platform for launching and trading tokens with streaming rewards on Base L2.

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

# Key Smart Contracts

- LP Factory: `0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8`
- GDA Forwarder: `0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08`
- Superfluid Host: `0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74`

# Core Patterns

- Token data managed via `useTokenData` context (centralized balance management)
- API routes follow `/api/[resource]/[action]` pattern
- All addresses lowercase in API calls
- Token amounts use BigInt
- Timestamps use Firestore format (`_seconds`, `_nanoseconds`)

# UI

- Use DaisyUI defaults for the UI unless there are specific styles that need to be applied.
- Use TailwindCSS to make light adjustments.

# Authentication / Wallet Connection

- Privy handles desktop/mobile authentication, but wagmi is used for Farcaster mini-app.

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

- npm run build: Build the project
- npm run lint: Run the linter
- npm run typecheck: Check for type errors
- npm run check:all: Check for all errors (do this when you're done making changes)
- npm test: Run tests
- npm run dev: Start development server

# Workflow

- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
- Check balance call tracking in console during development
- Use existing patterns when adding features
- Update types in `/src/app/types/` when modifying data structures

# Notes

- params needs to be awaited in this version of Next.js
