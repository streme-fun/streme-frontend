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
