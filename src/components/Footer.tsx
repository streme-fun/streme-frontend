"use client";

import { useState, useEffect } from "react";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { ExternalLink } from "./ui/ExternalLink";
import { fetchTokenPrice } from "../lib/priceUtils";
import Image from "next/image";

export function Footer() {
  const { isMiniAppView } = useAppFrameLogic();
  const [stremePrice, setStremePrice] = useState<number | null>(null);

  const STREME_CONTRACT = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
  const DEXSCREENER_URL =
    "https://dexscreener.com/base/0x9187c24a3a81618f07a9722b935617458f532737";

  // Fetch STREME price on mount and periodically
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await fetchTokenPrice(STREME_CONTRACT);
      setStremePrice(price);
    };

    fetchPrice();
    // Update price every minute
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isMiniAppView) {
    return null;
  }

  return (
    <footer className="mt-auto py-8 border-t border-black/[.1] dark:border-white/[.1]">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <ExternalLink
              href="https://docs.streme.fun"
              className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            >
              Docs
            </ExternalLink>
            {/* Farcaster link */}
            <ExternalLink
              href="https://farcaster.xyz/streme"
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 1000 1000"
                className="w-5 h-5"
              >
                <path
                  fill="currentColor"
                  d="M257.778 155.556h484.444v688.889h-71.111V528.889h-.697c-7.86-87.212-81.156-155.556-170.414-155.556-89.258 0-162.554 68.344-170.414 155.556h-.697v315.556h-71.111V155.556Z"
                ></path>
                <path
                  fill="currentColor"
                  d="m128.889 253.333 28.889 97.778h24.444v395.556c-12.273 0-22.222 9.949-22.222 22.222v26.667h-4.444c-12.273 0-22.223 9.949-22.223 22.222v26.667h248.889v-26.667c0-12.273-9.949-22.222-22.222-22.222h-4.444v-26.667c0-12.273-9.95-22.222-22.223-22.222h-26.666V253.333H128.889ZM675.556 746.667c-12.274 0-22.223 9.949-22.223 22.222v26.667h-4.444c-12.273 0-22.222 9.949-22.222 22.222v26.667h248.889v-26.667c0-12.273-9.95-22.222-22.223-22.222h-4.444v-26.667c0-12.273-9.949-22.222-22.222-22.222V351.111h24.444L880 253.333H702.222v493.334h-26.666Z"
                ></path>
              </svg>
            </ExternalLink>
            {/* X link */}
            <ExternalLink
              href="https://x.com/StremeFun"
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <svg
                stroke="currentColor"
                fill="currentColor"
                strokeWidth="0"
                role="img"
                viewBox="0 0 24 24"
                className="w-4 h-4"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path>
              </svg>
            </ExternalLink>
          </div>

          {/* Powered by Streme with price */}
          <div className="flex items-center gap-1 text-sm">
            <span className="opacity-60">Powered by</span>
            <a
              href={DEXSCREENER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <span className="font-bold">Streme</span>
              <Image
                src="/icon-transparent.png"
                alt="STREME"
                width={20}
                height={20}
                className="inline-block"
              />
              {stremePrice !== null && (
                <span className="text-primary font-mono">
                  $
                  {stremePrice < 0.01
                    ? stremePrice.toFixed(6)
                    : stremePrice.toFixed(4)}
                </span>
              )}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
