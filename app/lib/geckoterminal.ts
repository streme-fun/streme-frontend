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

    // console.log("GeckoTerminal Raw Response:", data);

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
    // Add base URL for API calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/geckoterminal?poolAddress=${poolAddress}`
    );
    const data: GeckoTerminalResponse = await response.json();

    // console.log("GeckoTerminal raw response:", {
    //   poolAddress,
    //   data: data.data.attributes,
    // });

    // Remove the '+' or '-' prefix from percentage strings
    const cleanPercentage = (str: string) =>
      parseFloat(str.replace(/%/g, "").replace(/[+]/g, ""));

    return {
      price: parseFloat(data.data.attributes.price_in_usd),
      change1h: cleanPercentage(
        data.data.attributes.price_percent_changes.last_1h
      ),
      change24h: cleanPercentage(
        data.data.attributes.price_percent_changes.last_24h
      ),
      volume24h: parseFloat(data.data.attributes.from_volume_in_usd),
      marketCap: parseFloat(data.data.attributes.fully_diluted_valuation),
    };
  } catch (error) {
    console.error("Error fetching pool data for address:", poolAddress, error);
    return null;
  }
}
