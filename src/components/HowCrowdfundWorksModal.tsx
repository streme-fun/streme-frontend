"use client";

import { useEffect } from "react";

interface HowCrowdfundWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMiniApp?: boolean;
}

export function HowCrowdfundWorksModal({
  isOpen,
  onClose,
  isMiniApp = false,
}: HowCrowdfundWorksModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 ${
        isMiniApp ? "flex items-end" : "flex items-center justify-center"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-base-100 p-6 max-h-[90vh] overflow-y-auto shadow-xl border border-base-300 ${
          isMiniApp ? "w-full rounded-t-xl" : "rounded-xl max-w-md mx-4"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">How Streme Crowdfund Works</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-base mb-2">🎯 The Goal</h3>
            <p className="text-sm text-base-content/70">
              Grow Streme by funding initiatives.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-base mb-2">💰 How It Works</h3>
            <p className="text-sm text-base-content/70">
              Your STREME tokens generate yield when staked. Instead of keeping
              that yield, you redirect it to fund Streme&apos;s growth
              initiatives. You can withdraw your staked tokens anytime.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-base mb-2">🎁 Rewards</h3>
            <p className="text-sm text-base-content/70">
              Earn Superfluid $SUP tokens based on your contribution size. Be
              sure to claim daily to update your flow rate.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-base-300">
          <button onClick={onClose} className="btn btn-primary w-full">
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
