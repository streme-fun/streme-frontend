"use client";

import { CreateForm } from "./CreateForm";

export default function CreatePage() {
  return (
    <>
      {/* <div className="fixed inset-0 -z-10">
        <HeroAnimationMini />
      </div> */}
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-24 relative z-10 bg-base-100">
        <div className="mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Create a Streme Token
            </h1>
            <p className="opacity-60">
              Create a token with staking rewards. 20% of the total supply will
              be streamed to stakers over 365 days.
            </p>
          </div>
          <CreateForm />
        </div>
      </div>
    </>
  );
}
