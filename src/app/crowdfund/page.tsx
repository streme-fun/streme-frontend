import CrowdfundPage from "./crowdfund";

import { Metadata } from "next";
import { APP_NAME, APP_URL } from "../../lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const crowdfundTitle = "Fund a Streme QR Auction Win";
  const crowdfundDescription = "Contribute your staking $STREME yield to earn SUP rewards and help Streme get discovered by 10,000+ quality users via QR Auction.";
  const crowdfundOgImageUrl = `${APP_URL}/api/crowdfund/image`;
  const pageUrl = `${APP_URL}/crowdfund`;

  // Create custom frame embed for crowdfund with custom button text
  const frameEmbed = {
    version: "next",
    imageUrl: crowdfundOgImageUrl,
    button: {
      title: "Join Stream QR Crowdfund",
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

export default function RootCrowdfundPage() {
  return <CrowdfundPage />;
}