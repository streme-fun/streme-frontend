"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { StreamingBalance } from "./StreamingBalance";
import { useRouter } from "next/navigation";
import { MiniAppTutorialModal } from "./MiniAppTutorialModal";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { HowItWorksModal } from "./HowItWorksModal";
import { useWallet } from "../hooks/useWallet";

export function Navbar() {
  // Use new simplified wallet hook
  const { isConnected, address, connect, disconnect, isMiniApp, isLoading } =
    useWallet();
  const router = useRouter();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Easter egg function for logo clicking (desktop only - mini-app handling moved to app.tsx)
  const handleLogoClick = () => {
    if (!isMiniApp) {
      router.push("/crowdfund");
    }
  };

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

  // const handleMiniAppConnect = () => {
  //   const fcConnector = wagmiConnectors.find((c) => c.id === "farcaster");
  //   if (fcConnector) {
  //     wagmiConnect({ connector: fcConnector });
  //   } else {
  //     console.warn(
  //       "Farcaster connector not found. Ensure it's configured in WagmiProvider.tsx and active in the Farcaster client."
  //     );
  //     if (wagmiConnectors.length > 0) {
  //       // wagmiConnect({ connector: wagmiConnectors[0] });
  //     }
  //   }
  // };

  // Mini-app navigation is now handled in app.tsx
  if (isMiniApp) {
    return null;
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 border-b border-black/[.1] dark:border-white/[.1]  bg-opacity-80 bg-base-100 ">
        <div className="px-4 sm:px-8 lg:px-20 h-20 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              {isDark ? (
                <Image
                  src="/streme-text-white.svg"
                  width={180}
                  height={26}
                  alt="Streme"
                  onClick={handleLogoClick}
                  className="cursor-pointer"
                  priority
                />
              ) : (
                <Image
                  src="/streme-text-black.svg"
                  width={180}
                  height={26}
                  alt="Streme"
                  onClick={handleLogoClick}
                  className="cursor-pointer"
                  priority
                />
              )}
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden btn btn-ghost btn-sm"
            aria-label="Toggle menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  isMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                }
              />
            </svg>
          </button>

          <div className="hidden lg:flex items-center gap-6">
            {isConnected && (
              <Link href="/token/0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58">
                <div className="px-3 py-2 cursor-pointer hover:bg-base-100 transition-colors">
                  <StreamingBalance />
                </div>
              </Link>
            )}
            {/* link to create page */}
            <Link href="/launch" className="btn btn-primary">
              Launch a Token
            </Link>

            <button
              onClick={() => setIsHowItWorksOpen(true)}
              className="btn btn-ghost"
            >
              How It Works
            </button>

            <button
              onClick={() => setIsTutorialOpen(true)}
              className="btn btn-ghost btn-circle"
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

            <ThemeSwitcher />

            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={() =>
                      setIsAddressDropdownOpen(!isAddressDropdownOpen)
                    }
                    className="btn btn-ghost gap-2"
                    disabled={!address || isLoading}
                  >
                    {address
                      ? truncateAddress(address)
                      : isLoading
                      ? "Connecting..."
                      : "No Address"}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {isAddressDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-base-100 rounded-lg shadow-lg border border-base-300">
                      <Link
                        href="/tokens"
                        onClick={() => setIsAddressDropdownOpen(false)}
                        className="block w-full px-4 py-2 text-left hover:bg-base-200 cursor-pointer"
                      >
                        My Tokens
                      </Link>

                      <Link
                        href="/launched-tokens"
                        onClick={() => setIsAddressDropdownOpen(false)}
                        className="block w-full px-4 py-2 text-left hover:bg-base-200 cursor-pointer"
                      >
                        Launched Tokens
                      </Link>
                      <button
                        onClick={() => {
                          disconnect();
                          setIsAddressDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-base-200 rounded-lg cursor-pointer"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={connect}
                className="btn btn-ghost"
                disabled={isLoading}
              >
                {isLoading ? "Connecting..." : "Login"}
              </button>
            )}
          </div>
        </div>

        <div
          className={`lg:hidden ${
            isMenuOpen ? "block" : "hidden"
          } border-t border-black/[.1] dark:border-white/[.1] bg-background/95 backdrop-blur-sm`}
        >
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/launch"
              className="btn btn-primary w-full justify-start"
            >
              Launch a Token
            </Link>

            {isConnected && (
              <Link
                href="/tokens"
                className="btn btn-accent w-full justify-start"
                onClick={() => setIsMenuOpen(false)}
              >
                My Tokens
              </Link>
            )}

            {isConnected && (
              <Link
                href="/token/0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58"
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="px-3 py-2 rounded-lg hover:bg-base-200 transition-colors">
                  <StreamingBalance />
                </div>
              </Link>
            )}

            <button
              onClick={() => {
                setIsHowItWorksOpen(true);
                setIsMenuOpen(false);
              }}
              className="btn btn-ghost w-full justify-start"
            >
              How It Works
            </button>

            <button
              onClick={() => {
                setIsTutorialOpen(true);
                setIsMenuOpen(false);
              }}
              className="btn btn-ghost w-full justify-start"
            >
              Tutorial
            </button>

            <div className="flex items-center justify-between w-full px-4 py-2">
              <ThemeSwitcher className="w-full justify-start" />
            </div>

            {isConnected && (
              <Link
                href="/launched-tokens"
                className="btn btn-ghost w-full justify-start"
                onClick={() => setIsMenuOpen(false)}
              >
                Launched Tokens
              </Link>
            )}

            {isConnected ? (
              <button
                onClick={() => {
                  disconnect();
                  setIsMenuOpen(false);
                }}
                className="btn btn-ghost w-full justify-start"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => {
                  connect();
                  setIsMenuOpen(false);
                }}
                className="btn btn-ghost w-full justify-start"
                disabled={isLoading}
              >
                {isLoading ? "Connecting..." : "Login"}
              </button>
            )}
          </div>
        </div>
      </nav>

      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />
      <MiniAppTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onSkip={() => setIsTutorialOpen(false)}
      />
    </>
  );
}
