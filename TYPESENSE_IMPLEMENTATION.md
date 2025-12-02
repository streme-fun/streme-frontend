# Typesense Search Implementation

This document describes the Typesense search integration for streme.fun token discovery.

## Overview

Typesense is now integrated into the search functionality, providing fast, typo-tolerant search results across token names, symbols, usernames, and contract addresses.

## Files Added

### 1. `src/lib/typesenseClient.ts`

Core Typesense client configuration and search functions.

**Key Functions:**
- `searchTokens(query: string, limit?: number)`: Searches tokens using Typesense via the server-side API proxy

**Configuration:**
- Uses environment variables: `TYPESENSE_API_KEY`, `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL` (server-side only)
- Default: `api.streme.fun` on port 443 with HTTPS

**Search Fields:**
The search indexes the following fields from the Typesense schema:
- `name` - Token name
- `symbol` - Token symbol
- `username` - Creator username
- `contract_address` - Token contract address

### 2. `src/hooks/useTypesenseSearch.ts`

React hook for managing search state and debounced queries.

**Features:**
- Debounced search (default 300ms, customizable)
- Loading state management
- Error handling
- Automatic cleanup on unmount

**Usage:**
```typescript
const { query, setQuery, results, isLoading, error } = useTypesenseSearch(
  initialQuery,
  { debounceMs: 200, limit: 8 }
);
```

### 3. Updated `src/components/SearchBar.tsx`

Enhanced search bar with dropdown suggestions.

**New Features:**
- Real-time search suggestions dropdown
- Shows market cap for each token
- Click to navigate to token page
- Configurable suggestions display
- Click-outside detection to close dropdown
- Loading state during search

**Props:**
- `value: string` - Current search query
- `onChange: (value: string) => void` - Called when user types
- `onSelectToken?: (contractAddress: string) => void` - Optional callback when token selected
- `showSuggestions?: boolean` - Enable/disable dropdown (default: true)

## Environment Variables

Add these to your `.env.local` file:

```bash
TYPESENSE_API_KEY=your_api_key_here
TYPESENSE_HOST=api.streme.fun
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
```

## Usage in Components

The SearchBar component in `app.tsx` now automatically integrates Typesense:

```tsx
<SearchBar
  value={searchQuery}
  onChange={(value) => setSearchQuery(value)}
/>
```

The dropdown suggestions will:
1. Appear when user types (with debouncing)
2. Show up to 8 matching tokens
3. Display token name, symbol, creator, and market cap
4. Navigate to token page when clicked

## Search Results Schema

Each token result includes:
- `id` - Unique identifier (contract address)
- `name` - Token name
- `symbol` - Token symbol
- `contract_address` - Smart contract address
- `deployer` - Deployer wallet address
- `requestor_fid` - Farcaster ID of token creator
- `username` - Creator's username
- `type` - Token type
- `chain_id` - Blockchain chain ID
- `market_cap` - Current market cap
- `volume` - 24h trading volume
- `timestamp` - Token creation timestamp

## Integration Notes

1. **Client-Side Search**: The SearchBar now displays suggestions dropdown alongside the existing TokenGrid filtering
2. **Fallback**: The TokenGrid still maintains client-side filtering as a fallback
3. **Performance**: Search results are debounced to reduce API calls during typing
4. **Error Handling**: Gracefully handles Typesense API errors and returns empty results

## Future Improvements

- Add faceted search (filter by chain, type, etc.)
- Implement advanced search syntax
- Add search analytics/tracking
- Cache popular search results
- Add keyboard navigation (arrow keys) to dropdown
- Add "trending" search suggestions when input is empty
