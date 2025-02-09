import { TokenPageContent } from "./TokenPageContent";
import { Metadata } from "next";

// Make the page dynamic to ensure fresh meta tags
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Add metadata function to generate OG and Frame tags
export async function generateMetadata({
  params,
}: {
  params: { address: string };
}): Promise<Metadata> {
  const tokenAddress = params.address;

  // Base URL - replace with your actual domain
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://streme.fun";
  const pageUrl = `${baseUrl}/token/${tokenAddress}`;

  // Frame image URL - replace with your actual image generation URL
  const imageUrl = `${baseUrl}/api/og/token/${tokenAddress}`;

  return {
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: "View Token Details",
      description: "Check out this token and start staking",
      images: [imageUrl],
    },
    other: {
      // Frame metadata
      "fc:frame": "vNext",
      "fc:frame:image": imageUrl,
      "fc:frame:button:1": "View Token",
      "fc:frame:button:1:action": "link",
      "fc:frame:button:1:target": pageUrl,
      "fc:frame:button:2": "Share",
      "fc:frame:button:2:action": "link",
      "fc:frame:button:2:target": `https://warpcast.com/~/compose?text=Check%20out%20this%20token!%20${encodeURIComponent(
        pageUrl
      )}`,
    },
  };
}

export default function TokenPage() {
  return <TokenPageContent />;
}
