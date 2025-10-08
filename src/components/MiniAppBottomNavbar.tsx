"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LaunchTokenModal } from "./LaunchTokenModal";
import { SUPLeaderboardModal } from "./SUPLeaderboardModal";
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

export function MiniAppBottomNavbar({
  profileImage,
  userData,
}: MiniAppBottomNavbarProps) {
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
      console.warn(
        "Farcaster SDK not loaded or sdk not available. Opening CreateTokenModal as fallback."
      );
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
              isActive("/")
                ? "text-primary"
                : "text-base-content/70 hover:text-primary"
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

          {/* SUP Leaderboard Button */}
          <button
            onClick={() => setIsLeaderboardModalOpen(true)}
            className="flex flex-col items-center justify-center text-xs sm:text-sm text-base-content/70 hover:text-primary flex-1 cursor-pointer transition-colors"
          >
            <svg
              className="w-6 h-6 mb-0.5"
              viewBox="0 0 45 45"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M38.8027 0.647461H38.8076L39.0498 0.683594C40.2423 0.919985 41.1413 1.97266 41.1416 3.23438V39.0176C41.1416 40.4533 39.9777 41.6179 38.542 41.6182H3.02539C1.58945 41.6182 0.424805 40.4535 0.424805 39.0176V3.23438C0.425198 1.79873 1.58972 0.634766 3.02539 0.634766H38.5469L38.8027 0.647461ZM4.3252 37.7178H37.2422V4.53418H4.3252V37.7178ZM14.623 26.8369C14.954 26.8369 15.2234 27.1051 15.2236 27.4365V29.9697C15.2236 30.301 14.955 30.569 14.624 30.5693H12.0898C11.7585 30.5693 11.4902 30.3011 11.4902 29.9697V27.4365C11.4904 27.1053 11.7586 26.8369 12.0898 26.8369H14.623ZM27.1045 12.0127C27.8143 12.0127 28.3552 12.0123 28.7627 12.0576C29.1691 12.1028 29.4651 12.195 29.668 12.3975C29.8708 12.6003 29.9635 12.8971 30.0088 13.3037C30.0541 13.7112 30.0537 14.2523 30.0537 14.9619V22.9141C30.0537 23.2465 29.7835 23.5107 29.4531 23.5107H26.7539C26.4225 23.5107 26.1543 23.2425 26.1543 22.9111V16.3115C26.1541 16.091 25.974 15.9111 25.7529 15.9111H20.2695C19.9382 15.9111 19.67 15.6428 19.6699 15.3115V12.6123C19.6701 12.2814 19.9374 12.013 20.2686 12.0127H27.1045Z" />
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
      <SUPLeaderboardModal
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
