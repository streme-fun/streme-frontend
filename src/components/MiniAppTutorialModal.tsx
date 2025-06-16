"use client";

import { Modal } from "./Modal";
import { useState } from "react";
import Image from "next/image";

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
      title: "Streme Tokens Are Built Different",
      content: (
        <div className="space-y-4">
          <p className="text-base text-base-content/80">
            Every token launched on Streme distributes 20% of its supply to
            stakers over 365 days as rewards.
          </p>

          <p className="text-base text-base-content/80">
            Rewards are <span className="italic">streamed</span> to
            stakers&apos; wallets every second proportional to their stake.
          </p>
          <Image
            src="/onboarding-rewards.gif"
            alt="Streme Mini App"
            width={300}
            height={300}
          />
        </div>
      ),
    },
    {
      title: "Streme to qualify for SUP",
      content: (
        <div className="space-y-4">
          <p className="text-base text-base-content/80">
            Streme users can get in on the Superfluid SUP drop. We&apos;re tight
            like that.
          </p>
          <p className="text-base text-base-content/80">
            To qualify, do things like add the mini-app, hold or stake tokens,
            or launch your own token. The more you do, the more you get.
          </p>

          <Image
            src="/onboarding-SUP.png"
            alt="Onboarding SUP"
            width={150}
            height={150}
            className="rounded-lg"
          />
        </div>
      ),
    },
    {
      title: "Ape. Stake. Earn.",
      content: (
        <div className="space-y-4 text-center">
          <div className="text-6xl mb-4">🎊</div>
          <p className="text-base text-base-content/80">
            Play around and explore. Launch, stake, earn rewards streamed to
            your wallet, top up your stakes from time to time, and have fun. And
            don&apos;t forget to and claim your SUP!
          </p>
          <div className="bg-accent/10 p-4 rounded-lg border border-accent/20">
            <p className="text-sm font-medium">
              💡 Need help or want to help? Hit up @zeni.eth or @markcarey on
              Farcaster
              <br />
            </p>
          </div>
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
