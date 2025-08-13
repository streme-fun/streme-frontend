"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LaunchTokenModal } from "./LaunchTokenModal";
import { LeaderboardModal } from "./LeaderboardModal";
import { WalletProfileModal } from "./WalletProfileModal";
import { MyTokensModal } from "./MyTokensModal";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import sdk from "@farcaster/miniapp-sdk";

interface MiniAppBottomNavbarProps {
  profileImage?: string;
  userData?: {
    displayName: string;
    username: string;
    profileImage: string;
  } | null;
}

export function MiniAppBottomNavbar({ profileImage, userData }: MiniAppBottomNavbarProps) {
  const pathname = usePathname();
  const { isSDKLoaded } = useAppFrameLogic();
  
  // Modal states
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  const [isWalletProfileOpen, setIsWalletProfileOpen] = useState(false);
  const [isMyStakesOpen, setIsMyStakesOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const handleLaunchClick = async () => {
    if (isSDKLoaded && sdk) {
      try {
        const castText = `@streme Launch a token for me

Name: [your token name]
Symbol: $[your ticker]

[Don't forget to attach an image!] 🎨`;
        await sdk.actions.composeCast({
          text: castText,
          embeds: [],
        });
      } catch (error) {
        console.error("Error composing cast:", error);
        setIsCreateTokenOpen(true);
      }
    } else {
      console.warn("Farcaster SDK not loaded or sdk not available. Opening CreateTokenModal as fallback.");
      setIsCreateTokenOpen(true);
    }
  };

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pb-4 pt-2 bg-background/80 border-t border-black/[.1] bg-base-100 bg-opacity-80">
        <div className="px-2 sm:px-4 py-2 flex items-center justify-around gap-1 sm:gap-2">
          {/* Home Button */}
          <Link
            href="/"
            className={`flex flex-col items-center justify-center text-xs sm:text-sm flex-1 cursor-pointer transition-colors ${
              isActive("/") ? "text-primary" : "text-base-content/70 hover:text-primary"
            }`}
          >
            <svg
              className="w-6 h-6 mb-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              ></path>
            </svg>
            Home
          </Link>

          {/* My Tokens Button */}
          <button
            onClick={() => setIsMyStakesOpen(true)}
            className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer transition-colors"
          >
            <div className="w-6 h-6 mb-0.5 rounded-full border-2 border-current flex items-center justify-center">
              <svg
                className="w-2 h-3"
                viewBox="0 0 21 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.54794 30V25.071H20.4343V30H0.54794ZM2.97692 17.6847V12.9261H18.1048V17.6847H2.97692ZM1.08771 5.90909V0.90909H19.5252V5.90909H1.08771Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            My Tokens
          </button>

          {/* Launch Button */}
          <button
            onClick={handleLaunchClick}
            className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer transition-colors"
          >
            <svg
              className="w-6 h-6 mb-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              ></path>
            </svg>
            Launch
          </button>

          {/* Leaderboard Button */}
          <button
            onClick={() => setIsLeaderboardModalOpen(true)}
            className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer transition-colors"
          >
            <svg
              className="w-6 h-6 mb-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              ></path>
            </svg>
            SUP Claims
          </button>

          {/* Profile Button */}
          <button
            onClick={() => setIsWalletProfileOpen(true)}
            className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer transition-colors"
          >
            {profileImage ? (
              <div className="relative w-6 h-6 mb-0.5 rounded-full overflow-hidden">
                <Image
                  src={profileImage}
                  alt="Profile"
                  fill
                  className="object-cover"
                  unoptimized={
                    profileImage.includes(".gif") ||
                    profileImage.includes("imagedelivery.net")
                  }
                />
              </div>
            ) : (
              <svg
                className="w-6 h-6 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                ></path>
              </svg>
            )}
            Profile
          </button>
        </div>
      </nav>

      {/* Modals */}
      <LaunchTokenModal
        isOpen={isCreateTokenOpen}
        onClose={() => setIsCreateTokenOpen(false)}
      />
      <LeaderboardModal
        isOpen={isLeaderboardModalOpen}
        onClose={() => setIsLeaderboardModalOpen(false)}
      />
      <WalletProfileModal
        isOpen={isWalletProfileOpen}
        onClose={() => setIsWalletProfileOpen(false)}
        preloadedUserData={userData}
      />
      <MyTokensModal
        isOpen={isMyStakesOpen}
        onClose={() => setIsMyStakesOpen(false)}
      />
    </>
  );
}