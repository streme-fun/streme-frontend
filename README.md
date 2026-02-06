
# Streme Frontend

The frontend for [Streme](https://streme.fun) — a token launcher for Superfluid Supertokens on Base.

## Overview

Streme enables streaming token distributions using Superfluid's real-time finance protocol. Instead of discrete token transfers, holders receive continuous streams of tokens.

## Tech Stack

- **Framework:** Next.js 15
- **Styling:** Tailwind CSS + DaisyUI
- **Wallet:** RainbowKit + wagmi + viem
- **Auth:** Farcaster Auth Kit + Sign In With Farcaster
- **Search:** Typesense
- **Analytics:** PostHog

## Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/streme-fun/streme-frontend.git
cd streme-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests |
| `npm run test:coverage` | Run tests with coverage |

## Project Structure

```
src/
├── app/          # Next.js App Router pages
├── components/   # React components
├── lib/          # Utility functions and shared logic
└── ...
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- **Live App:** [streme.fun](https://streme.fun)
- **Farcaster:** [@streme](https://warpcast.com/streme)
- **Superfluid:** [superfluid.finance](https://superfluid.finance)
