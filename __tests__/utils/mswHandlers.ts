import { http, HttpResponse } from 'msw'
import { mockApiResponses, mockTokens } from './mockData'

export const handlers = [
  // Token endpoints
  http.get('/api/tokens', () => {
    return HttpResponse.json(mockApiResponses.tokens)
  }),

  http.get('/api/tokens/single', ({ request }) => {
    const url = new URL(request.url)
    const address = url.searchParams.get('address')
    const token = mockTokens.find(t => t.contract_address === address)
    
    if (token) {
      return HttpResponse.json({ data: token })
    }
    
    return HttpResponse.json({ error: 'Token not found' }, { status: 404 })
  }),

  http.get('/api/token/:tokenAddress/claimable-fees', () => {
    return HttpResponse.json({
      amount0: 1000000000000000, // 0.001 token
      amount1: 500000000000000, // 0.0005 WETH
      token0: mockTokens[0].contract_address,
      token1: '0x4200000000000000000000000000000000000006', // WETH
    })
  }),

  // User endpoints
  http.get('/api/user/:address/balance/:tokenAddress', () => {
    return HttpResponse.json(mockApiResponses.userBalance)
  }),

  http.get('/api/sup-eligibility/:address', () => {
    return HttpResponse.json(mockApiResponses.supEligibility)
  }),

  http.get('/api/sup-points/:address', () => {
    return HttpResponse.json(mockApiResponses.supPoints)
  }),

  // External API mocks
  http.get('https://api.geckoterminal.com/api/v2/networks/base/tokens/multi/:addresses', () => {
    return HttpResponse.json({
      data: mockTokens.map(token => ({
        id: `base_${token.contract_address}`,
        attributes: {
          address: token.contract_address,
          name: token.name,
          symbol: token.symbol,
          decimals: 18,
          price_usd: token.marketData?.price?.toString() || "0",
          fdv_usd: token.marketData?.marketCap?.toString() || "0",
          market_cap_usd: token.marketData?.marketCap?.toString() || "0",
          volume_usd: {
            h24: token.marketData?.volume24h?.toString() || "0",
          },
        },
      })),
    })
  }),

  // 0x API mock
  http.get('/api/price', ({ request }) => {
    const url = new URL(request.url)
    const sellAmount = url.searchParams.get('sellAmount')
    
    return HttpResponse.json({
      buyAmount: (BigInt(sellAmount || '0') * BigInt(2)).toString(), // Mock 2:1 exchange rate
      sellAmount: sellAmount || '0',
      liquidityAvailable: true,
      price: '2',
      estimatedGas: '100000',
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
    })
  }),

  // Gasless swap mock
  http.post('/api/gasless-swap/quote', async ({ request }) => {
    const body = await request.json() as any
    
    return HttpResponse.json({
      approval: {
        to: mockTokens[0].contract_address,
        data: '0xapprovaldata',
      },
      trade: {
        to: '0x0000000000000000000000000000000000000000',
        data: '0xtradedata',
        value: '0',
      },
      buyAmount: (BigInt(body?.sellAmount || '0') * BigInt(2)).toString(),
      sellAmount: body?.sellAmount || '0',
    })
  }),

  // Streme API mock
  http.get('https://www.streme.xyz/api/tokens/:contractAddress', ({ params }) => {
    const token = mockTokens.find(t => t.contract_address === params.contractAddress)
    
    if (token) {
      return HttpResponse.json({
        success: true,
        data: {
          ...token,
          // Add additional fields that Streme API returns
          socials: {
            twitter: 'https://twitter.com/streme',
            telegram: 'https://t.me/streme',
          },
          description: 'Test token description',
        },
      })
    }
    
    return HttpResponse.json({ success: false, error: 'Token not found' }, { status: 404 })
  }),
]