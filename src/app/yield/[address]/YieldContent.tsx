"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import SafeImage from "@/src/components/SafeImage";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import type { AccountYield, YieldFlow } from "@/src/lib/yield";

interface YieldIdentity {
  username?: string;
  pfp_url?: string;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

/** Live counter for one stream, accumulating from page load. */
function StreamedSinceLoad({ tokensPerDay }: { tokensPerDay: number }) {
  const [loadedAt] = useState(() => Date.now());
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 50);
    return () => clearInterval(interval);
  }, []);

  const streamed = ((Date.now() - loadedAt) / 1000) * (tokensPerDay / 86400);
  return (
    <span className="font-mono text-success">
      +{streamed.toFixed(6)}
    </span>
  );
}

export default function YieldContent({ address }: { address: string }) {
  const [data, setData] = useState<AccountYield | null>(null);
  const [identity, setIdentity] = useState<YieldIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isMiniAppView, isSDKLoaded } = useAppFrameLogic();

  useEffect(() => {
    const load = async () => {
      try {
        const [yieldRes, userRes] = await Promise.all([
          fetch(`/api/yield/${address}`),
          fetch(`/api/users/by-address?address=${address}`),
        ]);
        if (!yieldRes.ok) throw new Error(`HTTP ${yieldRes.status}`);
        setData(await yieldRes.json());
        if (userRes.ok) {
          const userData = await userRes.json();
          const user = userData?.data?.[0] ?? userData?.user;
          if (user) setIdentity(user);
        }
      } catch (err) {
        console.error("Error loading yield data:", err);
        setError("Failed to load yield data");
      }
    };
    load();
  }, [address]);

  const heroFlow: YieldFlow | undefined = data?.flows[0];

  const castText = useMemo(() => {
    if (!heroFlow) return "Streaming staking rewards every second on Streme 🌊";
    const more =
      (data?.flows.length ?? 0) > 1
        ? ` (+${(data!.flows.length - 1)} more streams)`
        : "";
    return `I'm earning +${formatAmount(heroFlow.tokensPerDay)} $${
      heroFlow.symbol
    }/day just for staking on Streme${more} 🌊\n\nStreamed to my wallet every second, onchain.`;
  }, [heroFlow, data]);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/yield/${address}`;
    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({ text: castText, embeds: [shareUrl] });
        return;
      } catch (error) {
        console.error("Error composing cast:", error);
      }
    }
    window.open(
      `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
        castText
      )}&embeds[]=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
  }, [address, castText, isMiniAppView, isSDKLoaded]);

  if (error && !data) {
    return (
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-3xl text-center">
        <div className="alert alert-error max-w-md mx-auto">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-3xl">
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-12 max-w-3xl">
      {/* Identity */}
      <div className="flex items-center gap-4 mb-8">
        <div className="avatar">
          <div className="w-14 h-14 rounded-full">
            <SafeImage
              src={identity?.pfp_url}
              alt="profile"
              width={56}
              height={56}
              className="rounded-full object-cover"
            />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {identity?.username
              ? `@${identity.username}`
              : shortAddress(address)}
          </h1>
          <p className="opacity-70 text-sm">
            {data.activeStreams > 0
              ? `${data.activeStreams} live reward stream${
                  data.activeStreams === 1 ? "" : "s"
                }, paid every second`
              : "No active reward streams yet"}
          </p>
        </div>
      </div>

      {data.flows.length === 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body items-center text-center py-16">
            <p className="text-lg opacity-70 max-w-md">
              This wallet isn&apos;t earning streaming rewards yet. Stake any
              Streme token and rewards start flowing into your wallet every
              second.
            </p>
            <Link href="/" className="btn btn-primary mt-4">
              Explore Tokens
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Hero stream */}
          {heroFlow && (
            <div className="card bg-base-100 shadow-md mb-6 overflow-hidden">
              <div className="card-body">
                <div className="flex items-center gap-4">
                  <div className="avatar">
                    <div className="w-16 h-16 rounded-2xl">
                      <SafeImage
                        src={heroFlow.img_url}
                        alt={heroFlow.name}
                        width={64}
                        height={64}
                        className="rounded-2xl object-cover"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-4xl font-bold font-mono text-success">
                      +{formatAmount(heroFlow.tokensPerDay)}
                    </div>
                    <div className="opacity-70">
                      ${heroFlow.symbol} per day
                      {heroFlow.usdPerDay && heroFlow.usdPerDay >= 0.01
                        ? ` · ≈ $${heroFlow.usdPerDay.toFixed(2)}/day`
                        : ""}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm opacity-70">
                  Streamed since you opened this page:{" "}
                  <StreamedSinceLoad tokensPerDay={heroFlow.tokensPerDay} />{" "}
                  ${heroFlow.symbol}
                </div>
              </div>
            </div>
          )}

          {/* Other streams */}
          {data.flows.length > 1 && (
            <div className="card bg-base-100 shadow-sm mb-6">
              <div className="card-body p-4 space-y-3">
                {data.flows.slice(1).map((flow) => (
                  <Link
                    key={flow.tokenAddress}
                    href={`/token/${flow.tokenAddress}`}
                    className="flex items-center gap-3 hover:bg-base-200 rounded-lg p-2 -m-2 transition-colors"
                  >
                    <div className="avatar">
                      <div className="w-9 h-9 rounded-lg">
                        <SafeImage
                          src={flow.img_url}
                          alt={flow.name}
                          width={36}
                          height={36}
                          className="rounded-lg object-cover"
                        />
                      </div>
                    </div>
                    <span className="font-semibold flex-1 truncate">
                      ${flow.symbol}
                    </span>
                    <span className="font-mono text-sm text-success">
                      +{formatAmount(flow.tokensPerDay)}/day
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <button onClick={handleShare} className="btn btn-primary w-full">
            Share My Stream 🌊
          </button>
        </>
      )}

      <p className="text-xs opacity-50 mt-10 text-center">
        Streme tokens stream staking rewards by the second via Superfluid.{" "}
        <Link href="/pulse" className="link">
          See what&apos;s streaming now →
        </Link>
      </p>
    </div>
  );
}
