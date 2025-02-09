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
    const data = await response.json();

    console.log("GeckoTerminal Raw Response:", data);

    if (!data.data) return {};

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

    console.log("Processed GeckoTerminal Data:", processedData);
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
        last_1h: string;
        last_24h: string;
        last_7d?: string;
      };
      volume_in_usd: string;
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
    const response = await fetch(
      `https://app.geckoterminal.com/api/p1/base/pools/${poolAddress}`
    );
    const data: GeckoTerminalResponse = await response.json();
    return {
      price: parseFloat(data.data.attributes.price_in_usd),
      change1h: parseFloat(data.data.attributes.price_percent_changes.last_1h),
      change24h: parseFloat(
        data.data.attributes.price_percent_changes.last_24h
      ),
      volume24h: parseFloat(data.data.attributes.volume_in_usd),
      marketCap: parseFloat(data.data.attributes.fully_diluted_valuation),
    };
  } catch (error) {
    console.error("Error fetching pool data for address:", poolAddress, error);
    return null;
  }
}
