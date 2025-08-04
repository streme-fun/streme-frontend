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
      title: "Launch tokens with streaming superpowers",
      content: (
        <div className="space-y-4">
          <TutorialStreamingAnimation />

          <p className="text-base text-base-content/80">
            With Streme, launch Base tokens with built-in streaming superpowers
            and streaming twists on staking, crowdfunding, and more.
          </p>

          <p className="text-base text-base-content/80">
            Earn from tokens you launch with 40% of LP fees, claimable as
            frequently as you want.
          </p>
        </div>
      ),
    },

    {
      title: "Stake to Earn Streaming Rewards",
      content: (
        <div className="space-y-4">
          <GrowthFundAnimation contributorCount={25} growthRate={2.5} />

          <p className="text-base text-base-content/80">
            Stake Streme coins to earn rewards streamed to your wallet every
            second. The more you stake, the more you earn.
          </p>
          <p className="text-base text-base-content/80">
            For qualifying tokens, reroute your staking rewards to support
            growth initiatives via streaming crowdfunds.
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
            There are lots of ways to earn — add the mini-app, stake or hodl
            tokens, contribute to crowdfunds, or launch your own token!
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
