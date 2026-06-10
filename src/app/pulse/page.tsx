import type { Metadata } from "next";
import PulseContent from "./PulseContent";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";
const pageUrl = `${baseUrl}/pulse`;
const imageUrl = `${baseUrl}/api/pulse/image`;

const frameEmbed = {
  version: "next",
  imageUrl,
  button: {
    title: "Open Streme Pulse",
    action: {
      type: "launch_frame",
      name: "Streme",
      url: pageUrl,
      splashImageUrl: `${baseUrl}/icon.png`,
      splashBackgroundColor: "#ffffff",
    },
  },
};

export const metadata: Metadata = {
  title: "Streme Pulse - Live Streaming Token Rankings",
  description:
    "What's streaming right now on Streme: live token rankings, milestones, and the automated @streme bot activity log.",
  openGraph: {
    title: "Streme Pulse",
    description:
      "Live rankings of tokens streaming staking rewards every second on Base.",
    images: [{ url: imageUrl, width: 1200, height: 800, alt: "Streme Pulse" }],
    type: "website",
    siteName: "Streme",
    url: pageUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Streme Pulse",
    description:
      "Live rankings of tokens streaming staking rewards every second on Base.",
    images: [imageUrl],
    site: "@streme",
  },
  other: {
    "fc:frame": JSON.stringify(frameEmbed),
  },
};

export default function PulsePage() {
  return <PulseContent />;
}
