import CrowdfundPage from "../crowdfund";
import { Metadata } from "next";
import { APP_NAME, APP_URL } from "../../../lib/constants";
import { getCrowdfundTokenBySlug } from "../../../lib/crowdfundTokens";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token: tokenSlug } = await params;
  const crowdfundToken = getCrowdfundTokenBySlug(tokenSlug);

  if (!crowdfundToken) {
    return {
      title: `Crowdfund Not Found | ${APP_NAME}`,
      description: "This crowdfund campaign does not exist.",
    };
  }

  const crowdfundTitle = `${crowdfundToken.name} Crowdfund`;
  const crowdfundDescription =
    crowdfundToken.description ||
    `Contribute to the ${crowdfundToken.name} crowdfund and earn rewards.`;
  const crowdfundOgImageUrl = `${APP_URL}/api/crowdfund/image?token=${tokenSlug}`;
  const pageUrl = `${APP_URL}/crowdfund/${tokenSlug}`;

  // Create custom frame embed for crowdfund with custom button text
  const frameEmbed = {
    version: "next",
    imageUrl: crowdfundOgImageUrl,
    button: {
      title: `Join ${crowdfundToken.name} Fund`,
      action: {
        type: "launch_frame",
        name: APP_NAME,
        url: pageUrl,
        splashImageUrl: `${APP_URL}/android-chrome-512x512.png`,
        splashBackgroundColor: "#FFFFFF",
      },
    },
  };

  return {
    title: `${crowdfundTitle} | ${APP_NAME}`,
    description: crowdfundDescription,
    openGraph: {
      title: crowdfundTitle,
      description: crowdfundDescription,
      images: [crowdfundOgImageUrl],
      type: "website",
      siteName: APP_NAME,
      url: pageUrl,
    },
    other: {
      "fc:frame": JSON.stringify(frameEmbed),
    },
  };
}

export default async function TokenCrowdfundPage({ params }: Props) {
  const { token: tokenSlug } = await params;
  const crowdfundToken = getCrowdfundTokenBySlug(tokenSlug);

  if (!crowdfundToken) {
    notFound();
  }

  return (
    <CrowdfundPage
      tokenAddress={crowdfundToken.address}
      tokenConfig={crowdfundToken}
    />
  );
}
