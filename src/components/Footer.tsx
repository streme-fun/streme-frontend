"use client";

import { useAppFrameLogic } from "../hooks/useAppFrameLogic";

export function Footer() {
  const { isMiniAppView } = useAppFrameLogic();

  if (isMiniAppView) {
    return null;
  }

  return (
    <footer className="mt-auto py-8 border-t border-black/[.1] dark:border-white/[.1]">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a
            href="https://docs.streme.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm opacity-60 hover:opacity-100 transition-opacity"
          >
            Docs
          </a>
          {/* Farcaster link */}
          <a
            href="https://farcaster.xyz/streme"
            target="_blank"
            rel="noopener noreferrer"
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
          </a>
          {/* X link */}
          <a
            href="https://x.com/StremeFun"
            target="_blank"
            rel="noopener noreferrer"
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
          </a>
        </div>
      </div>
    </footer>
  );
}
