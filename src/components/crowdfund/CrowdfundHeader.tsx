"use client";

import { CrowdfundToken } from "@/src/lib/crowdfundTokens";

interface CrowdfundHeaderProps {
  tokenConfig?: CrowdfundToken;
  isMiniAppView: boolean;
  onShowHowItWorks: () => void;
}

export default function CrowdfundHeader({
  tokenConfig,
  isMiniAppView,
  onShowHowItWorks,
}: CrowdfundHeaderProps) {
  return (
    <div
      className={`container mx-auto px-4 sm:pt-4 ${
        isMiniAppView ? "pt-2" : "pt-24"
      }`}
    >
      <div className="mb-1">
        <div className="flex justify-between items-start">
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-1 justify-between">
              <h2 className="text-lg md:text-xl font-bold text-base-content">
                {tokenConfig?.fundTitle ||
                  `${tokenConfig?.name || "Token"} Crowdfund`}
              </h2>
              {/* Info button in top right */}
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={onShowHowItWorks}
                  className="btn btn-ghost btn-sm btn-circle flex-shrink-0"
                  title="How it works"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <p className="text-sm text-base-content/70 leading-snug">
              {tokenConfig?.fundDescription ||
                "Support the growth of this project by contributing your staked tokens."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}