"use client";

import { useState } from "react";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import { ExternalLink } from "./ui/ExternalLink";

export function Footer() {
  const { isMiniAppView } = useAppFrameLogic();
  const [copied, setCopied] = useState(false);

  const STREME_CONTRACT = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(STREME_CONTRACT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

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

          {/* STREME Contract Address */}
          <div className="flex items-center gap-2 text-xs opacity-60">
            <span>CA:</span>
            <span className="font-mono">{STREME_CONTRACT}</span>
            <button
              onClick={handleCopy}
              className="btn btn-ghost btn-xs px-2 py-1 min-h-0 h-auto opacity-60 hover:opacity-100 transition-opacity"
              title="Copy contract address"
            >
              {copied ? (
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
