"use client";

import { Modal } from "./Modal";
import { useState } from "react";
import { TutorialStreamingAnimation } from "./TutorialStreamingAnimation";
import { GrowthFundAnimation } from "./GrowthFundAnimation";

interface MiniAppTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkip: () => void;
}

export function MiniAppTutorialModal({
  isOpen,
  onClose,
  onSkip,
}: MiniAppTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Launch tokens with streaming superpowers. Earn fees.",
      content: (
        <div className="space-y-4">
          <TutorialStreamingAnimation />

          <p className="text-base text-base-content/80">
            🚀 Launch a Base ERC-20 token with built-in staking and Superfluid
            streaming.
          </p>

          <p className="text-base text-base-content/80">
            🌊 20% of the total supply is streamed to stakers over 365 days.
          </p>

          <p className="text-base text-base-content/80">
            💰 Earn 40% of fees on every swap.
          </p>
        </div>
      ),
    },

    {
      title: "Stake to earn rewards",
      content: (
        <div className="space-y-4">
          <GrowthFundAnimation contributorCount={25} growthRate={2.5} />

          <p className="text-base text-base-content/80">
            20% of each token&apos;s total supply is allocated to the rewards
            pool, distributed over 365 days proportionally to stakers (24h lock
            after staking).
          </p>
          <p className="text-base text-base-content/80">
            Stake any token launched on Streme to earn rewards in that token
            streamed to your wallet every second.
          </p>
        </div>
      ),
    },
    {
      title: "Use Streme to Earn SUP",
      content: (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-32 h-32 object-contain"
            >
              <source src="/coinspin.webm" type="video/webm" />
            </video>
          </div>
          <p className="text-base text-base-content/80">
            Streme is an official Superfluid ecosystem partner and distributor
            of $SUP tokens.
          </p>
          <p className="text-base text-base-content/80">
            To earn, just buy, stake, or hodl Streme tokens, contribute to
            crowdfunds, or launch your own token!
          </p>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">{steps[currentStep].title}</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            ✕
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 flex-1 rounded-full transition-colors ${
                index <= currentStep ? "bg-primary" : "bg-base-300"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[300px]">{steps[currentStep].content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button onClick={handleBack} className="btn btn-ghost btn-sm">
                ← Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {currentStep < steps.length - 1 && (
              <button onClick={handleSkip} className="btn btn-ghost btn-sm">
                Skip Tutorial
              </button>
            )}
            <button onClick={handleNext} className="btn btn-primary btn-sm">
              {currentStep === steps.length - 1 ? "Get Started!" : "Next →"}
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="text-center text-xs text-base-content/60">
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>
    </Modal>
  );
}
