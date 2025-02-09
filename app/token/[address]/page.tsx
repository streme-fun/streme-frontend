import { TokenPageContent } from "./TokenPageContent";
import { Metadata } from "next";

interface TokenResponse {
  id: number;
  name: string;
  symbol: string;
  img_url: string;
  contract_address: string;
  requestor_fid: number;
  pool_address: string;
}

// Make this a dynamic metadata function
export async function generateMetadata({
  params,
}: {
  params: { address: string };
}): Promise<Metadata> {
  // Await the dynamic param address before using it
  const address = await Promise.resolve(params.address);

  try {
    // Fetch specific token data directly
    const response = await fetch(`https://api.streme.fun/token/${address}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        title: "Token Not Found",
        description: "The requested token could not be found",
      };
    }

    const token: TokenResponse = await response.json();
    const tokenUrl = `https://streme.fun/token/${address}`;

    return {
      title: `${token.name} ($${token.symbol})`,
      description: `Check out ${token.name} ($${token.symbol}) on Streme.fun!`,
      metadataBase: new URL("https://streme.fun"),
      viewport: "width=device-width, initial-scale=1",
      other: {
        "fc:frame": "vNext",
        "fc:frame:image":
          token.img_url || "https://streme.fun/default-token-image.png",
        "fc:frame:image:aspect_ratio": "1:1",
        "fc:frame:button:1": "Trade",
        "fc:frame:button:1:action": "link",
        "fc:frame:button:1:target": tokenUrl,
        "fc:frame:button:2": "Share",
        "fc:frame:button:2:action": "link",
        "fc:frame:button:2:target": `https://warpcast.com/~/compose?text=Check%20out%20${encodeURIComponent(
          `${token.name} ($${token.symbol})`
        )}%20on%20Streme.fun!&embeds[]=${encodeURIComponent(tokenUrl)}`,
        "og:image":
          token.img_url || "https://streme.fun/default-token-image.png",
      },
      openGraph: {
        title: `${token.name} ($${token.symbol})`,
        images: token.img_url || "https://streme.fun/default-token-image.png",
      },
    };
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return {
      title: "Error",
      description: "Failed to load token information",
    };
  }
}

export default function TokenPage() {
  return <TokenPageContent />;
}
