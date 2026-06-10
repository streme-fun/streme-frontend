import type { Metadata } from "next";
import SurfPageClient from "./SurfPageClient";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";

interface Props {
  searchParams: Promise<{ d?: string; by?: string; r?: string }>;
}

function parseChallenge(params: { d?: string; by?: string; r?: string }) {
  const distance = Number(params.d);
  if (!Number.isFinite(distance) || distance <= 0 || distance > 1_000_000) {
    return null;
  }
  const by =
    typeof params.by === "string" && /^[a-z0-9_.-]{1,32}$/i.test(params.by)
      ? params.by
      : undefined;
  const rank = Number(params.r);
  return {
    distance: Math.floor(distance),
    by,
    rank: Number.isInteger(rank) && rank > 0 ? rank : undefined,
  };
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const challenge = parseChallenge(await searchParams);

  const title = "Streme Surf - Ride the Stream";
  const description = challenge
    ? `Someone${
        challenge.by ? ` (@${challenge.by})` : ""
      } rode the stream ${challenge.distance}m in Streme Surf. Think you can beat it?`
    : "Surf an endless stream in 3D. Drag to steer, dodge the rocks, and pop bubbles as you ride. How far can you flow?";

  const imageParams = new URLSearchParams();
  if (challenge) {
    imageParams.set("d", String(challenge.distance));
    if (challenge.by) imageParams.set("by", challenge.by);
    if (challenge.rank) imageParams.set("r", String(challenge.rank));
  }
  const imageUrl = `${baseUrl}/api/surf/image${
    imageParams.size > 0 ? `?${imageParams.toString()}` : ""
  }`;

  const pageParams = new URLSearchParams();
  if (challenge) {
    pageParams.set("d", String(challenge.distance));
    if (challenge.by) pageParams.set("by", challenge.by);
  }
  const pageUrl = `${baseUrl}/surf${
    pageParams.size > 0 ? `?${pageParams.toString()}` : ""
  }`;

  const frameEmbed = {
    version: "next",
    imageUrl,
    button: {
      title: challenge
        ? `🏄 Beat ${challenge.distance}m`
        : "🏄 Play Streme Surf",
      action: {
        type: "launch_frame",
        name: "Streme",
        url: pageUrl,
        splashImageUrl: `${baseUrl}/icon.png`,
        splashBackgroundColor: "#0a0f24",
      },
    },
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [imageUrl],
    },
    other: {
      "fc:frame": JSON.stringify(frameEmbed),
    },
  };
}

export default async function SurfPage({ searchParams }: Props) {
  const challenge = parseChallenge(await searchParams);
  return <SurfPageClient challenge={challenge} />;
}
