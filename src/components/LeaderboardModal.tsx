"use client";

import { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [isSDKReady, setIsSDKReady] = useState(false);

  useEffect(() => {
    // The SDK is imported directly, so we can assume it's available
    // if the import was successful. We'll check for the actions object.
    if (sdk && sdk.actions) {
      setIsSDKReady(true);
    } else {
      setIsSDKReady(false);
      console.warn("Farcaster SDK or sdk.actions is not available.");
    }
  }, []); // Run once on component mount

  if (!isOpen) return null;

  const handleClaimAirdrop = async () => {
    const claimUrl = "https://claim.superfluid.org/claim";
    if (isSDKReady && sdk && sdk.actions && sdk.actions.openUrl) {
      try {
        // According to the provided documentation, openUrl can take an object
        // but if the linter complains about a string, let's try with a string first.
        // The documentation snippet shows: await sdk.actions.openUrl({ url: "<https://yoink.today/>" });
        // And then shows the type as: type OpenExternalUrl = (options: { url: string; close?: boolean; }) => Promise<void>;
        // However, another part of the docs for openUrl shows `await sdk.actions.openUrl(url)`
        // Let's stick to the simpler string version first if the object is an issue.
        // Re-checking the provided docs: `await sdk.actions.openUrl(url)` where url is a string.
        // The more complex type `OpenExternalUrl = (options: { url: string; close?: boolean; })` seems to be a type definition,
        // not necessarily the direct usage. The usage example `await sdk.actions.openUrl(url)` is clearer.

        // The error `Argument of type '{ url: string; }' is not assignable to parameter of type 'string'.`
        // indicates that `openUrl` indeed expects a string.
        await sdk.actions.openUrl(claimUrl);
        onClose(); // Optionally close modal after opening URL
      } catch (error) {
        console.error("Error opening URL via Farcaster SDK:", error);
        // Fallback to window.open if SDK fails
        window.open(claimUrl, "_blank");
      }
    } else {
      console.warn(
        "Farcaster SDK not available for openUrl, falling back to window.open."
      );
      window.open(claimUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-md transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            Leaderboard Coming Soon
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
        <div className="text-gray-600 space-y-4">
          <p>
            The Streme leaderboard is coming soon. In the meantime, Streme users
            qualify for Superfluid $SUP airdrop rewards.
          </p>
          <p>
            Click on the button below to go to the Superfluid site and claim
            your airdrop.
          </p>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
          <button
            onClick={handleClaimAirdrop}
            className="btn btn-primary w-full sm:w-auto"
          >
            Claim Airdrop
          </button>
          <button onClick={onClose} className="btn btn-ghost w-full sm:w-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
