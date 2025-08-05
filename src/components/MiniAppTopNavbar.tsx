"use client";

import Link from "next/link";
import { StreamingBalance } from "./StreamingBalance";
import { usePostHog } from "posthog-js/react";
import { memo, useCallback } from "react";

interface MiniAppTopNavbarProps {
  isConnected: boolean;
  onLogoClick?: () => void;
  onTutorialClick: () => void;
}

function MiniAppTopNavbarComponent({ isConnected, onLogoClick, onTutorialClick }: MiniAppTopNavbarProps) {
  const postHog = usePostHog();

  // Memoize the tutorial button click handler to prevent unnecessary re-renders
  const handleTutorialClick = useCallback(() => {
    onTutorialClick();
    postHog?.capture("tutorial_opened", {
      context: "farcaster_mini_app",
      opened_by: "help_button",
    });
  }, [onTutorialClick, postHog]);

  return (
    <div className="fixed top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-base-100/80 backdrop-blur-sm">
      <div className="flex-shrink-0">
        <Link href="/" className="flex items-center">
          <svg
            width="100"
            height="17"
            viewBox="0 0 391 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onClick={onLogoClick}
            className={onLogoClick ? "cursor-pointer" : ""}
          >
            <path
              d="M40.1619 21.2614C39.8892 18.5114 38.7188 16.375 36.6506 14.8523C34.5824 13.3295 31.7756 12.5682 28.2301 12.5682C25.821 12.5682 23.7869 12.9091 22.1278 13.5909C20.4688 14.25 19.196 15.1705 18.3097 16.3523C17.446 17.5341 17.0142 18.875 17.0142 20.375C16.9688 21.625 17.2301 22.7159 17.7983 23.6477C18.3892 24.5795 19.196 25.3864 20.2188 26.0682C21.2415 26.7273 22.4233 27.3068 23.7642 27.8068C25.1051 28.2841 26.5369 28.6932 28.0597 29.0341L34.3324 30.5341C37.3778 31.2159 40.1733 32.125 42.7188 33.2614C45.2642 34.3977 47.4688 35.7955 49.3324 37.4545C51.196 39.1136 52.6392 41.0682 53.6619 43.3182C54.7074 45.5682 55.2415 48.1477 55.2642 51.0568C55.2415 55.3295 54.1506 59.0341 51.9915 62.1705C49.8551 65.2841 46.7642 67.7045 42.7188 69.4318C38.696 71.1364 33.8438 71.9886 28.1619 71.9886C22.5256 71.9886 17.6165 71.125 13.4347 69.3977C9.27557 67.6705 6.02557 65.1136 3.68466 61.7273C1.36648 58.3182 0.150568 54.1023 0.0369318 49.0795H14.321C14.4801 51.4205 15.1506 53.375 16.3324 54.9432C17.5369 56.4886 19.1392 57.6591 21.1392 58.4545C23.1619 59.2273 25.446 59.6136 27.9915 59.6136C30.4915 59.6136 32.6619 59.25 34.5028 58.5227C36.3665 57.7955 37.8097 56.7841 38.8324 55.4886C39.8551 54.1932 40.3665 52.7045 40.3665 51.0227C40.3665 49.4545 39.9006 48.1364 38.9688 47.0682C38.0597 46 36.7188 45.0909 34.946 44.3409C33.196 43.5909 31.0483 42.9091 28.5028 42.2955L20.9006 40.3864C15.0142 38.9545 10.3665 36.7159 6.95739 33.6705C3.5483 30.625 1.85511 26.5227 1.87784 21.3636C1.85511 17.1364 2.98011 13.4432 5.25284 10.2841C7.5483 7.125 10.696 4.65909 14.696 2.88636C18.696 1.11363 23.2415 0.22727 28.3324 0.22727C33.5142 0.22727 38.0369 1.11363 41.9006 2.88636C45.7869 4.65909 48.8097 7.125 50.9688 10.2841C53.1278 13.4432 54.2415 17.1023 54.3097 21.2614H40.1619ZM62.5341 13.3523V1.18182H119.875V13.3523H98.5V71H83.9091V13.3523H62.5341ZM129.318 71V1.18182H156.864C162.136 1.18182 166.636 2.125 170.364 4.01136C174.114 5.875 176.966 8.52273 178.92 11.9545C180.898 15.3636 181.886 19.375 181.886 23.9886C181.886 28.625 180.886 32.6136 178.886 35.9545C176.886 39.2727 173.989 41.8182 170.193 43.5909C166.42 45.3636 161.852 46.25 156.489 46.25H138.045V34.3864H154.102C156.92 34.3864 159.261 34 161.125 33.2273C162.989 32.4545 164.375 31.2955 165.284 29.75C166.216 28.2045 166.682 26.2841 166.682 23.9886C166.682 21.6705 166.216 19.7159 165.284 18.125C164.375 16.5341 162.977 15.3295 161.091 14.5114C159.227 13.6705 156.875 13.25 154.034 13.25H144.08V71H129.318ZM167.023 39.2273L184.375 71H168.08L151.102 39.2273H167.023ZM255.224 1.18182H273.429L292.656 48.0909H293.474L312.702 1.18182H330.906V71H316.588V25.5568H316.009L297.94 70.6591H288.19L270.122 25.3864H269.543V71H255.224V1.18182ZM343.068 71V1.18182H390.114V13.3523H357.83V29.9886H387.693V42.1591H357.83V58.8295H390.25V71H343.068Z"
              className="fill-primary"
            />
            <path
              d="M193.818 71V59.1705H241.545V71H193.818ZM199.648 41.4432V30.0227H235.955V41.4432H199.648ZM195.114 13.1818V1.18182H239.364V13.1818H195.114Z"
              className="fill-secondary"
            />
          </svg>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {isConnected && (
          <Link href="/token/0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58">
            <div className="bg-base-100/90 backdrop-blur-sm rounded-lg px-3 py-2 cursor-pointer hover:bg-base-100 transition-colors">
              <StreamingBalance />
            </div>
          </Link>
        )}
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
const arePropsEqual = (prevProps: MiniAppTopNavbarProps, nextProps: MiniAppTopNavbarProps) => {
  return (
    prevProps.isConnected === nextProps.isConnected &&
    prevProps.onLogoClick === nextProps.onLogoClick &&
    prevProps.onTutorialClick === nextProps.onTutorialClick
  );
};

// Export memoized component to prevent unnecessary re-renders
export const MiniAppTopNavbar = memo(MiniAppTopNavbarComponent, arePropsEqual);