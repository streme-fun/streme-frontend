import type { Metadata } from "next";
import SkatePageClient from "./SkatePageClient";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";

interface Props {
  searchParams: Promise<{ s?: string; by?: string; r?: string }>;
}

function parseChallenge(params: { s?: string; by?: string; r?: string }) {
  const score = Number(params.s);
  if (!Number.isFinite(score) || score <= 0 || score > 100_000_000) {
    return null;
  }
  const by =
    typeof params.by === "string" && /^[a-z0-9_.-]{1,32}$/i.test(params.by)
      ? params.by
      : undefined;
  const rank = Number(params.r);
  return {
    score: Math.floor(score),
    by,
    rank: Number.isInteger(rank) && rank > 0 ? rank : undefined,
  };
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const challenge = parseChallenge(await searchParams);

  const title = "Streme Skate - Grind the Stream";
  const description = challenge
    ? `Someone${
        challenge.by ? ` (@${challenge.by})` : ""
      } scored ${challenge.score.toLocaleString()} in Streme Skate. Think you can beat it?`
    : "A neon, GBA-style skate trick-attack. Ollie ramps, flip in the air, grind the streams, and stack combos. How high can you score?";

  const imageParams = new URLSearchParams();
  if (challenge) {
    imageParams.set("s", String(challenge.score));
    if (challenge.by) imageParams.set("by", challenge.by);
    if (challenge.rank) imageParams.set("r", String(challenge.rank));
  }
  const imageUrl = `${baseUrl}/api/skate/image${
    imageParams.size > 0 ? `?${imageParams.toString()}` : ""
  }`;

  const pageParams = new URLSearchParams();
  if (challenge) {
    pageParams.set("s", String(challenge.score));
    if (challenge.by) pageParams.set("by", challenge.by);
  }
  const pageUrl = `${baseUrl}/skate${
    pageParams.size > 0 ? `?${pageParams.toString()}` : ""
  }`;

  const frameEmbed = {
    version: "next",
    imageUrl,
    button: {
      title: challenge
        ? `🛹 Beat ${challenge.score.toLocaleString()}`
        : "🛹 Play Streme Skate",
      action: {
        type: "launch_frame",
        name: "Streme",
        url: pageUrl,
        splashImageUrl: `${baseUrl}/icon.png`,
        splashBackgroundColor: "#0c0626",
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

export default async function SkatePage({ searchParams }: Props) {
  const challenge = parseChallenge(await searchParams);
  return <SkatePageClient challenge={challenge} />;
}
