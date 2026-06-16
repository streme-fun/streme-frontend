"use client";

import Image from "next/image";
import { ArrowUpRight, BadgeCheck, Coins, RadioTower } from "lucide-react";
import { MouseEvent } from "react";
import { useNavigation } from "../hooks/useNavigation";
import { WARPLET_GOBBLER_URL } from "../lib/warpletGobbler";

type WarpletGobblerPromoProps = {
  variant?: "desktop" | "mini";
};

const featureChips = [
  { label: "Live auctions", Icon: RadioTower },
  { label: "Warplet bids", Icon: Coins },
];

export function WarpletGobblerPromo({
  variant = "desktop",
}: WarpletGobblerPromoProps) {
  const { isMiniAppView, openExternalUrl } = useNavigation();

  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isMiniAppView) return;

    event.preventDefault();
    void openExternalUrl(WARPLET_GOBBLER_URL);
  };

  if (variant === "mini") {
    return (
      <section aria-labelledby="warplet-gobbler-mini-title" className="w-full">
        <a
          href={WARPLET_GOBBLER_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpen}
          className="warplet-gobbler-promo group flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-base-200/85 p-3 text-left shadow-sm transition duration-200 hover:border-primary/45 hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className="relative h-16 w-16 flex-none overflow-hidden rounded-xl border border-base-300 bg-base-300">
            <Image
              src="/warplet-gobbler/warplet.png"
              alt="Warplet Gobbler artwork"
              fill
              sizes="64px"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              Now live
            </div>
            <h2
              id="warplet-gobbler-mini-title"
              className="mt-1 text-base font-bold leading-tight text-base-content"
            >
              Warplet Gobbler
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-base-content/70">
              Buy or sell Warplets in the live auction.
            </p>
          </div>
          <span className="inline-flex h-9 min-w-9 flex-none items-center justify-center rounded-full bg-primary text-primary-content transition duration-200 group-hover:scale-105">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Open Warplet Gobbler</span>
          </span>
        </a>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="warplet-gobbler-title"
      className="warplet-gobbler-promo w-full max-w-[1200px] px-4 mx-auto mt-6 mb-4"
    >
      <a
        href={WARPLET_GOBBLER_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpen}
        className="group grid overflow-hidden rounded-2xl border border-base-300 bg-base-100 text-base-content shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 p-5 sm:p-6 lg:p-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            Now live
          </div>
          <h2
            id="warplet-gobbler-title"
            className="mt-3 max-w-2xl text-2xl font-extrabold leading-tight text-base-content sm:text-3xl"
          >
            Warplet Gobbler is open
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/70 sm:text-base">
            Buy and sell Warplets through a live auction flywheel powered by
            Streme and Superfluid.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {featureChips.map(({ label, Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-200 px-3 py-1.5 text-sm font-medium text-base-content/80"
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-content transition duration-200 group-hover:gap-3">
            Open Gobbler
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="relative min-h-[190px] overflow-hidden border-t border-base-300 bg-base-200 md:min-h-full md:border-l md:border-t-0">
          <Image
            src="/warplet-gobbler/gobbled-warplet.jpg"
            alt="Warplet Gobbler launch artwork"
            fill
            sizes="(min-width: 768px) 320px, 100vw"
            className="object-cover object-center transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-base-100/30 via-transparent to-transparent md:bg-gradient-to-r md:from-base-100/15 md:to-transparent" />
        </div>
      </a>
    </section>
  );
}

