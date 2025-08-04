import CrowdfundPage from "./crowdfund";

import { Metadata } from "next";
import { APP_NAME, APP_URL } from "../../lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const crowdfundTitle = "Streme Growth Fund";
  const crowdfundDescription = "Contribute your staking $STREME yield to help fund Streme growth initiatives and earn SUP rewards.";
  const crowdfundOgImageUrl = `${APP_URL}/api/crowdfund/image`;
  const pageUrl = `${APP_URL}/crowdfund`;

  // Create custom frame embed for crowdfund with custom button text
  const frameEmbed = {
    version: "next",
    imageUrl: crowdfundOgImageUrl,
    button: {
      title: "Join Streme Growth Fund",
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