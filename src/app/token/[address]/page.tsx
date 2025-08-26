import { TokenPageContent } from "./TokenPageContent";
import { TokenPageProvider } from "@/src/contexts/TokenPageContext";
import { Metadata } from "next";

type Props = {
  params: Promise<{ address: string }>;
};

// Define type for cached token data
interface CachedTokenData {
  data: {
    name: string;
    symbol: string;
    price?: number;
    creator?: {
      name: string;
    };
    marketCap?: number;
  };
  timestamp: number;
}

// Simple in-memory cache for token metadata
const metadataCache = new Map<string, CachedTokenData>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedData(address: string): CachedTokenData["data"] | null {
  const cached = metadataCache.get(address?.toLowerCase() || "");
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Metadata] Using cached data for ${address}`);
    return cached.data;
  }
  return null;
}

function setCachedData(address: string, data: CachedTokenData["data"]): void {
  metadataCache.set(address?.toLowerCase() || "", {
    data,
    timestamp: Date.now(),
  });
}

// Helper function to retry API calls with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased timeout to 8 seconds

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      // If we get a 5xx error, retry (except on last attempt)
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(
          `[Metadata] Attempt ${attempt + 1} failed with status ${
            response.status
          }, retrying...`
        );
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Metadata] Attempt ${attempt + 1} failed:`, error);

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;

  try {
    // Determine the base URL - prefer environment variable, fallback to production URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";

    // Add more specific logging
    // console.log(`[Metadata] Generating metadata for token: ${address}`);
    // console.log(`[Metadata] Using base URL: ${baseUrl}`);

    // Check cache first
    const cachedToken = getCachedData(address);
    let token = cachedToken;

    if (!token) {
      // Fetch token data for metadata with retry logic
      const response = await fetchWithRetry(
        `${baseUrl}/api/tokens/single?address=${address}`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      // console.log(`[Metadata] API response status: ${response.status}`);

      if (!response.ok) {
        console.warn(
          `[Metadata] API call failed with status ${response.status} after retries, using fallback metadata`
        );
        throw new Error(`API call failed with status ${response.status}`);
      }

      const data = await response.json();
      // console.log(`[Metadata] API response data:`, data ? "received" : "empty");

      token = data.data;

      if (!token) {
        console.warn(
          `[Metadata] No token data received, using fallback metadata`
        );
        throw new Error("No token data received");
      }

      // Cache the successful response
      setCachedData(address, token);
    }

    // console.log(
    //   `[Metadata] Successfully loaded token: ${token.name} (${token.symbol})`
    // );

    // Remove the formatPrice function and simplify title generation
    const title = `${token.name} (${token.symbol}) - Streme`;
    const description = `Trade ${token.name} (${token.symbol}) on Streme${
      token.creator ? ` - Created by @${token.creator.name}` : ""
    }. ${
      token.marketCap ? `Market Cap: $${token.marketCap.toLocaleString()}` : ""
    }`;

    const imageUrl = `${baseUrl}/api/token/${address}/image`;
    const pageUrl = `${baseUrl}/token/${address}`;

    // console.log(`[Frame Debug] Token: ${token.name}, Image URL: ${imageUrl}`);

    // Create the Farcaster Frame Embed object
    // Ensure button title stays within 32 character limit
    const maxTitleLength = 32;
    const titlePrefix = "View ";
    const titleSuffix = " on Streme";
    const ellipsis = "...";
    const maxTokenNameLength = maxTitleLength - titlePrefix.length - titleSuffix.length;
    
    let displayName = token.name;
    if (displayName.length > maxTokenNameLength) {
      displayName = token.name.substring(0, maxTokenNameLength - ellipsis.length) + ellipsis;
    }
    
    const buttonTitle = `${titlePrefix}${displayName}${titleSuffix}`;
    
    const frameEmbed = {
      version: "next",
      imageUrl: imageUrl,
      button: {
        title: buttonTitle,
        action: {
          type: "launch_frame",
          name: "Streme",
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
            alt: `${token.name} (${token.symbol}) on Streme`,
          },
        ],
        type: "website",
        siteName: "Streme",
        url: pageUrl,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
        creator: token.creator ? `@${token.creator.name}` : "@streme",
        site: "@streme",
      },
      other: {
        // Farcaster Frame metadata - correct format
        "fc:frame": JSON.stringify(frameEmbed),
      },
    };
  } catch (error) {
    console.error(
      `[Metadata] Error generating metadata for token ${address}:`,
      error
    );

    // Fallback metadata with basic token info
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";
    const pageUrl = `${baseUrl}/token/${address}`;

    const fallbackFrameEmbed = {
      version: "next",
      imageUrl: `${baseUrl}/streme-og.png`,
      button: {
        title: "View Token on Streme",
        action: {
          type: "launch_frame",
          name: "Streme",
          url: pageUrl,
          splashImageUrl: `${baseUrl}/icon.png`,
          splashBackgroundColor: "#ffffff",
        },
      },
    };

    return {
      title: `Token ${address.slice(0, 6)}...${address.slice(-4)} - Streme`,
      description: "Trade tokens on Streme",
      openGraph: {
        title: "Streme",
        description: "Trade tokens on Streme",
        images: [
          {
            url: `${baseUrl}/streme-og.png`,
            width: 1200,
            height: 800,
            alt: "Streme",
          },
        ],
        type: "website",
        siteName: "Streme",
        url: pageUrl,
      },
      twitter: {
        card: "summary_large_image",
        title: "Streme",
        description: "Trade tokens on Streme",
        images: [`${baseUrl}/streme-og.png`],
        site: "@streme",
      },
      other: {
        // Fallback frame metadata
        "fc:frame": JSON.stringify(fallbackFrameEmbed),
      },
    };
  }
}

export default async function TokenPage({ params }: Props) {
  const { address } = await params;
  
  return (
    <TokenPageProvider tokenAddress={address}>
      <TokenPageContent />
    </TokenPageProvider>
  );
}
