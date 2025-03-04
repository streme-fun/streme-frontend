interface Token {
  contract_address: string;
  name: string;
  symbol: string;
  description: string;
}

export async function getTokenData(address: string) {
  try {
    // Fetch all tokens from our API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/tokens`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch tokens");
    }

    const { data: tokens } = await response.json();

    // Find the specific token by address
    const token = tokens.find(
      (t: Token) => t.contract_address.toLowerCase() === address.toLowerCase()
    );

    if (!token) {
      throw new Error("Token not found");
    }

    return {
      name: token.name,
      symbol: token.symbol,
      description: token.description,
      // Add any other token properties you want to use
    };
  } catch (error) {
    console.error("Error fetching token data:", error);
    // Return default values if token data fetch fails
    return {
      name: "Unknown Token",
      symbol: "UNKNOWN",
      description: "Token information unavailable",
    };
  }
}

export async function getTokens() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/tokens`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch tokens");
    }

    const { data: tokens } = await response.json();
    return tokens;
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return [];
  }
}
