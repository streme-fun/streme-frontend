const GECKOTERMINAL_API = "https://api.geckoterminal.com/api/v2";

export interface GeckoTerminalToken {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    image_url: string | null;
    price_usd: string;
    fdv_usd: string;
    total_reserve_in_usd: string;
    volume_usd: {
      h24: string;
    };
  };
}

export async function fetchTokensData(addresses: string[]) {
  try {
    const addressString = addresses.join(",");
    const response = await fetch(
      `${GECKOTERMINAL_API}/networks/base/tokens/multi/${addressString}`
    );

    if (!response.ok) {
      console.error(
        `GeckoTerminal API error: ${response.status} ${response.statusText}`
      );
      return {};
    }

    const data = await response.json();

    if (!data.data) {
      console.warn("No data returned from GeckoTerminal API");
      return {};
    }

    const processedData = data.data.reduce(
      (
        acc: Record<
          string,
          {
            price: number;
            marketCap: number;
            volume24h: number;
            total_reserve_in_usd: number;
          }
        >,
        token: GeckoTerminalToken
      ) => {
        const attrs = token.attributes;
        if (attrs.price_usd) {
          acc[attrs.address.toLowerCase()] = {
            price: parseFloat(attrs.price_usd),
            marketCap: parseFloat(attrs.fdv_usd || "0"),
            volume24h: parseFloat(attrs.volume_usd.h24 || "0"),
            total_reserve_in_usd: parseFloat(attrs.total_reserve_in_usd || "0"),
          };
        }
        return acc;
      },
      {}
    );

    return processedData;
  } catch (error) {
    console.error("Error fetching tokens data:", error);
    return {};
  }
}

export interface GeckoTerminalResponse {
  data: {
    attributes: {
      price_in_usd: string;
      price_percent_changes: {
        last_5m: string;
        last_15m: string;
        last_30m: string;
        last_1h: string;
        last_6h: string;
        last_24h: string;
      };
      from_volume_in_usd: string;
      fully_diluted_valuation: string;
    };
  };
}

export async function fetchPoolData(poolAddress: string) {
  if (!poolAddress) {
    console.warn("No pool address provided for GeckoTerminal API");
    return null;
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/geckoterminal?poolAddress=${poolAddress}`
    );

    if (!response.ok) {
      console.error(
        `GeckoTerminal API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    // Check for error response
    if (data.error) {
      console.error("GeckoTerminal API error:", data.error);
      return null;
    }

    // Validate data structure
    if (!data?.data?.attributes) {
      console.error("Invalid data structure from GeckoTerminal API");
      return null;
    }

    const attrs = data.data.attributes;

    // Remove the '+' or '-' prefix from percentage strings
    const cleanPercentage = (str: string) =>
      parseFloat(str.replace(/%/g, "").replace(/[+]/g, ""));

    return {
      price: parseFloat(attrs.price_in_usd || "0"),
      change1h: cleanPercentage(attrs.price_percent_changes?.last_1h || "0"),
      change24h: cleanPercentage(attrs.price_percent_changes?.last_24h || "0"),
      volume24h: parseFloat(attrs.from_volume_in_usd || "0"),
      marketCap: parseFloat(attrs.fully_diluted_valuation || "0"),
    };
  } catch (error) {
    console.error("Error fetching pool data for address:", poolAddress, error);
    return null;
  }
}
