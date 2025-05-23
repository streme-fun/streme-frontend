import { TokenPageContent } from "./TokenPageContent";
import { Metadata } from "next";

type Props = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;

  try {
    // Determine the base URL - prefer environment variable, fallback to production URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";

    // Fetch token data for metadata
    const response = await fetch(
      `${baseUrl}/api/tokens/single?address=${address}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Token not found");
    }

    const data = await response.json();
    const token = data.data;

    if (!token) {
      throw new Error("Token not found");
    }

    // Format price for title
    const formatPrice = (price: number | undefined) => {
      if (!price || isNaN(price)) return "";

      if (price < 0.01 && price > 0) {
        const decimalStr = price.toFixed(20).split(".")[1];
        let zeroCount = 0;
        while (decimalStr[zeroCount] === "0") {
          zeroCount++;
        }
        return ` | $0.0${zeroCount}${decimalStr.slice(
          zeroCount,
          zeroCount + 4
        )}`;
      }

      return ` | $${price.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })}`;
    };

    const title = `${token.name} (${token.symbol})${formatPrice(
      token.price
    )} - Streme.fun`;
    const description = `Trade ${token.name} (${token.symbol}) on Streme.fun${
      token.creator ? ` - Created by @${token.creator.name}` : ""
    }. ${
      token.marketCap ? `Market Cap: $${token.marketCap.toLocaleString()}` : ""
    }`;

    const imageUrl = `${baseUrl}/api/token/${address}/image`;
    const pageUrl = `${baseUrl}/token/${address}`;

    console.log(`[Frame Debug] Token: ${token.name}, Image URL: ${imageUrl}`);

    // Create the Farcaster Frame Embed object
    const frameEmbed = {
      version: "next",
      imageUrl: imageUrl,
      button: {
        title: "View Token on Streme",
        action: {
          type: "launch_frame",
          name: "Streme.fun",
          url: pageUrl,
          splashImageUrl: `${baseUrl}/icon.png`,
          splashBackgroundColor: "#ffffff",
        },
      },
    };

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 800,
            alt: `${token.name} (${token.symbol}) on Streme.fun`,
          },
        ],
        type: "website",
        siteName: "Streme.fun",
        url: pageUrl,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
        creator: token.creator ? `@${token.creator.name}` : "@streme_fun",
        site: "@streme_fun",
      },
      other: {
        // Farcaster Frame metadata - correct format
        "fc:frame": JSON.stringify(frameEmbed),
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);

    // Fallback metadata
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";

    const fallbackFrameEmbed = {
      version: "next",
      imageUrl: `${baseUrl}/streme-og.png`,
      button: {
        title: "Visit Streme.fun",
        action: {
          type: "launch_frame",
          name: "Streme.fun",
          url: baseUrl,
          splashImageUrl: `${baseUrl}/icon.png`,
          splashBackgroundColor: "#ffffff",
        },
      },
    };

    return {
      title: "Token - Streme.fun",
      description:
        "Trade tokens on Streme.fun - The premier memecoin trading platform on Base",
      openGraph: {
        title: "Streme.fun",
        description:
          "Trade tokens on Streme.fun - The premier memecoin trading platform on Base",
        images: [
          {
            url: `${baseUrl}/streme-og.png`,
            width: 1200,
            height: 800,
            alt: "Streme.fun - Premier memecoin trading platform",
          },
        ],
        type: "website",
        siteName: "Streme.fun",
        url: baseUrl,
      },
      twitter: {
        card: "summary_large_image",
        title: "Streme.fun",
        description:
          "Trade tokens on Streme.fun - The premier memecoin trading platform on Base",
        images: [`${baseUrl}/streme-og.png`],
        site: "@streme_fun",
      },
      other: {
        // Fallback frame metadata
        "fc:frame": JSON.stringify(fallbackFrameEmbed),
      },
    };
  }
}

export default function TokenPage() {
  return <TokenPageContent />;
}
