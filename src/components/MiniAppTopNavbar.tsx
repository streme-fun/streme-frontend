"use client";

import Link from "next/link";
import Image from "next/image";
import { StreamingBalance } from "./StreamingBalance";
import { usePostHog } from "posthog-js/react";
import { memo, useCallback, useEffect, useState } from "react";

interface MiniAppTopNavbarProps {
  isConnected: boolean;
  onLogoClick?: () => void;
  onTutorialClick: () => void;
}

function MiniAppTopNavbarComponent({
  isConnected,
  onLogoClick,
  onTutorialClick,
}: MiniAppTopNavbarProps) {
  const postHog = usePostHog();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      const htmlElement = document.documentElement;
      const dataTheme = htmlElement.getAttribute("data-theme");
      const hasClassDark = htmlElement.classList.contains("dark");
      const isDarkMode = dataTheme === "dark" || hasClassDark;

      setIsDark((prevIsDark) =>
        prevIsDark !== isDarkMode ? isDarkMode : prevIsDark
      );
    };

    checkDarkMode();

    const observer = new MutationObserver((mutations) => {
      const relevantChange = mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-theme" ||
            mutation.attributeName === "class")
      );

      if (relevantChange) {
        checkDarkMode();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", checkDarkMode);
    };
  }, []);

  // Memoize the tutorial button click handler to prevent unnecessary re-renders
  const handleTutorialClick = useCallback(() => {
    onTutorialClick();
    postHog?.capture("tutorial_opened", {
      context: "farcaster_mini_app",
      opened_by: "help_button",
    });
  }, [onTutorialClick, postHog]);

  return (
    <div className="fixed top-0 left-0 right-0 flex items-center justify-between py-4 px-8 z-40 bg-base-100/80 backdrop-blur-sm">
      <div className="flex-shrink-0">
        <Link href="/" className="flex items-center">
          {isDark ? (
            <Image
              src="/streme-text-white.svg"
              width={80}
              height={13}
              alt="Streme"
              onClick={onLogoClick}
              className={onLogoClick ? "cursor-pointer" : ""}
              priority
            />
          ) : (
            <Image
              src="/streme-text-black.svg"
              width={80}
              height={13}
              alt="Streme"
              onClick={onLogoClick}
              className={onLogoClick ? "cursor-pointer" : ""}
              priority
            />
          )}
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleTutorialClick}
          className="btn btn-ghost btn-circle btn-sm flex-shrink-0"
          title="Tutorial"
        >
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
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Memoization comparison function - only re-render if props actually change
const arePropsEqual = (
  prevProps: MiniAppTopNavbarProps,
  nextProps: MiniAppTopNavbarProps
) => {
  return (
    prevProps.isConnected === nextProps.isConnected &&
    prevProps.onLogoClick === nextProps.onLogoClick &&
    prevProps.onTutorialClick === nextProps.onTutorialClick
  );
};

// Export memoized component to prevent unnecessary re-renders
export const MiniAppTopNavbar = memo(MiniAppTopNavbarComponent, arePropsEqual);
