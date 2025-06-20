import { NextResponse } from "next/server";

export async function GET() {
  try {
    // STREME token contract address on Base
    const stremeAddress = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
    
    // Try CoinGecko API first
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${stremeAddress}&vs_currencies=usd`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const priceData = data[stremeAddress.toLowerCase()];
    
    if (priceData && priceData.usd) {
      return NextResponse.json({
        success: true,
        price: priceData.usd,
        source: 'coingecko',
        timestamp: Date.now()
      });
    } else {
      // If no price data, return fallback
      console.warn('No price data from CoinGecko for STREME, using fallback');
      return NextResponse.json({
        success: true,
        price: 0.000012, // Fallback price
        source: 'fallback',
        timestamp: Date.now()
      });
    }
    
  } catch (error) {
    console.error('Failed to fetch STREME price:', error);
    
    // Return fallback price on any error
    return NextResponse.json({
      success: true,
      price: 0.000012, // Fallback price
      source: 'fallback',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}