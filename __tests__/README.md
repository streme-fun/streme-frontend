# Test Suite Documentation

This test suite provides comprehensive testing for the Streme.fun Web3/DeFi application.

## Overview

The test suite covers:
- ✅ React components with Web3 interactions
- ✅ Custom hooks for data fetching and state management
- ✅ API routes and external integrations
- ✅ Utility functions and business logic
- ✅ Error handling and edge cases

## Test Structure

```
__tests__/
├── components/          # Component tests
│   └── StakeButton.test.tsx
├── hooks/              # Hook tests
│   └── useTokenData.test.ts
├── api/                # API route tests
│   └── tokens.test.ts
├── lib/                # Utility function tests
│   └── apiUtils.test.ts
└── utils/              # Test utilities
    ├── testUtils.tsx   # React testing utilities
    ├── web3Mocks.ts    # Web3 mocking utilities
    ├── mockData.ts     # Mock data
    └── mswHandlers.ts  # API mocking handlers
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Key Testing Patterns

### 1. Web3 Component Testing

Components that interact with smart contracts use comprehensive mocking:

```typescript
// Mock wallet providers
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ user: { wallet: { address: MOCK_ADDRESS } } }),
}))

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  usePublicClient: vi.fn(),
}))
```

### 2. API Route Testing

API routes are tested with MSW for realistic HTTP mocking:

```typescript
import { GET } from '@/src/app/api/tokens/route'
import { NextRequest } from 'next/server'

const request = new NextRequest('http://localhost:3000/api/tokens')
const response = await GET(request)
```

### 3. Hook Testing

Custom hooks are tested with React Testing Library:

```typescript
const { result } = renderHook(
  () => useTokenBalance(tokenAddress, stakingAddress, poolId),
  { wrapper: createWrapper() }
)
```

## Mock Strategy

### Web3 Mocking
- **Viem clients**: Mocked with realistic contract read/write responses
- **Wallet providers**: Mocked with address and transaction capabilities
- **Transaction receipts**: Simulated success/failure scenarios

### API Mocking
- **External APIs**: GeckoTerminal, Streme API, 0x Protocol
- **Cache layer**: Redis/KV operations
- **Rate limiting**: Simulated for realistic testing

### Data Mocking
- **Tokens**: Complete token objects with market data
- **Users**: Wallet addresses and Farcaster profiles
- **Transactions**: Realistic transaction hashes and receipts

## Testing Critical Paths

### 1. Staking Flow
- ✅ Token approval process
- ✅ Staking transaction execution
- ✅ Pool connection requirements
- ✅ Error handling for failed transactions

### 2. Data Fetching
- ✅ Token data enrichment
- ✅ Market data integration
- ✅ Caching behavior
- ✅ Retry logic for failed requests

### 3. User Interactions
- ✅ Wallet connection/disconnection
- ✅ Network switching
- ✅ Transaction confirmations
- ✅ Error state handling

## Coverage Goals

- **Components**: >80% coverage for critical Web3 components
- **Hooks**: >90% coverage for data fetching hooks
- **API Routes**: >85% coverage for business logic
- **Utilities**: >95% coverage for pure functions

## Best Practices

1. **Isolation**: Each test is independent with proper cleanup
2. **Realistic Mocking**: Mocks behave like real APIs/contracts
3. **Error Coverage**: Both success and failure scenarios tested
4. **Performance**: Fast execution with minimal external dependencies
5. **Maintainability**: Clear test names and organized structure

## Adding New Tests

When adding new tests:

1. Use existing test utilities in `__tests__/utils/`
2. Follow the established mocking patterns
3. Test both success and error scenarios
4. Include edge cases and validation
5. Add to the appropriate test category (components/hooks/api/lib)

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch pushes
- Release deployments

Failed tests block deployments to ensure code quality.