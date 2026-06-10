import type { Metadata } from "next";
import YieldContent from "./YieldContent";

interface Props {
  params: Promise<{ address: string }>;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { address } = await props.params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";
  const pageUrl = `${baseUrl}/yield/${address}`;
  const imageUrl = `${baseUrl}/api/yield/${address}/image`;

  const frameEmbed = {
    version: "next",
    imageUrl,
    button: {
      title: "See my stream",
      action: {
        type: "launch_frame",
        name: "Streme",
        url: pageUrl,
        splashImageUrl: `${baseUrl}/icon.png`,
        splashBackgroundColor: "#ffffff",
      },
    },
  };

  const title = "Streaming Yield - Streme";
  const description =
    "Staking rewards streamed every second on Base. See this wallet's live streams and start your own.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 800, alt: "Streaming yield" }],
      type: "website",
      siteName: "Streme",
      url: pageUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
      site: "@streme",
    },
    other: {
      "fc:frame": JSON.stringify(frameEmbed),
    },
  };
}

export default async function YieldPage(props: Props) {
  const { address } = await props.params;

  if (!ADDRESS_RE.test(address)) {
    return (
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-3xl text-center">
        <div className="alert alert-error max-w-md mx-auto">
          <span>Invalid wallet address</span>
        </div>
      </div>
    );
  }

  return <YieldContent address={address.toLowerCase()} />;
}
