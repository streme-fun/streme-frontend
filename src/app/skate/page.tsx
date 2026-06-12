import type { Metadata } from "next";
import SkatePageClient from "./SkatePageClient";
import { dailyKey, dailyName, isDailyKey } from "../../lib/skateDaily";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://streme.fun";

// Cache-busting token appended to the OG image URL. Vercel sets
// VERCEL_GIT_COMMIT_SHA per deploy, so every deploy yields a fresh image URL —
// Farcaster / CDN scrapers re-fetch the new render instead of serving a stale
// one when the card art changes. Set NEXT_PUBLIC_OG_VERSION to force a bust
// without a deploy (e.g. after swapping the background asset).
const OG_VERSION =
  process.env.NEXT_PUBLIC_OG_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  "dev";

interface Props {
  searchParams: Promise<{ s?: string; by?: string; r?: string; d?: string }>;
}

function parseChallenge(params: {
  s?: string;
  by?: string;
  r?: string;
  d?: string;
}) {
  const score = Number(params.s);
  if (!Number.isFinite(score) || score <= 0 || score > 100_000_000) {
    return null;
  }
  const by =
    typeof params.by === "string" && /^[a-z0-9_.-]{1,32}$/i.test(params.by)
      ? params.by
      : undefined;
  const rank = Number(params.r);
  const day =
    typeof params.d === "string" && isDailyKey(params.d) ? params.d : undefined;
  return {
    score: Math.floor(score),
    by,
    rank: Number.isInteger(rank) && rank > 0 ? rank : undefined,
    day,
  };
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const challenge = parseChallenge(await searchParams);
  const isLiveDaily = Boolean(challenge?.day && challenge.day === dailyKey());

  const title = isLiveDaily
    ? "Streme Skate — Daily Line"
    : "Streme Skate - Grind the Stream";
  const description = challenge
    ? challenge.day
      ? `${
          challenge.by ? `@${challenge.by}` : "Someone"
        } scored ${challenge.score.toLocaleString()} on the ${dailyName(
          challenge.day
        )} daily line. Same course for everyone, one counted shot a day — beat it before it resets.`
      : `Someone${
          challenge.by ? ` (@${challenge.by})` : ""
        } scored ${challenge.score.toLocaleString()} in Streme Skate. Think you can beat it?`
    : "A neon, GBA-style skate trick-attack. Ollie ramps, flip in the air, grind the streams, and stack combos. How high can you score?";

  const imageParams = new URLSearchParams();
  if (challenge) {
    imageParams.set("s", String(challenge.score));
    if (challenge.by) imageParams.set("by", challenge.by);
    if (challenge.rank) imageParams.set("r", String(challenge.rank));
    if (challenge.day) imageParams.set("d", challenge.day);
  }
  imageParams.set("v", OG_VERSION);
  const imageUrl = `${baseUrl}/api/skate/image?${imageParams.toString()}`;

  const pageParams = new URLSearchParams();
  if (challenge) {
    pageParams.set("s", String(challenge.score));
    if (challenge.by) pageParams.set("by", challenge.by);
    if (challenge.day) pageParams.set("d", challenge.day);
  }
  const pageUrl = `${baseUrl}/skate${
    pageParams.size > 0 ? `?${pageParams.toString()}` : ""
  }`;

  const frameEmbed = {
    version: "next",
    imageUrl,
    button: {
      title: isLiveDaily
        ? "⚡ Beat today's line"
        : challenge
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
