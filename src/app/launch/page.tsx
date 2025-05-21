"use client";

import { LaunchForm } from "./LaunchForm";

export default function LaunchPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Launch Your Token
          </h1>
          <p className="text-lg opacity-60">
            Create your own token with built-in staking rewards. 20% of the
            total supply will be streamed to stakers over 365 days.
          </p>
        </div>
        <LaunchForm />
      </div>
    </div>
  );
}
