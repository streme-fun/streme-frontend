"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MiniAppTutorialModal } from "./MiniAppTutorialModal";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { HowItWorksModal } from "./HowItWorksModal";
import { useWallet } from "../hooks/useWallet";

export function Navbar() {
  // Use new simplified wallet hook
  const {
    isConnected,
    address,
    connect,
    disconnect,
    isMiniApp,
    isLoading,
  } = useWallet();
  const router = useRouter();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

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
              <svg
                width="212"
                height="31"
                viewBox="0 0 212 31"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                onClick={handleLogoClick}
                className="cursor-pointer"
              >
                <path
                  d="M17.5909 9.27557C17.4773 8.12973 16.9896 7.23958 16.1278 6.60511C15.2661 5.97064 14.0966 5.65341 12.6193 5.65341C11.6155 5.65341 10.768 5.79545 10.0767 6.07955C9.38542 6.35417 8.85511 6.73769 8.4858 7.23011C8.12595 7.72254 7.94602 8.28125 7.94602 8.90625C7.92708 9.42708 8.03598 9.88163 8.27273 10.2699C8.51894 10.6581 8.85511 10.9943 9.28125 11.2784C9.70739 11.553 10.1998 11.7945 10.7585 12.0028C11.3172 12.2017 11.9138 12.3722 12.5483 12.5142L15.1619 13.1392C16.4309 13.4233 17.5956 13.8021 18.6562 14.2756C19.7169 14.7491 20.6354 15.3314 21.4119 16.0227C22.1884 16.714 22.7898 17.5284 23.2159 18.4659C23.6515 19.4034 23.8741 20.4782 23.8835 21.6903C23.8741 23.4706 23.4195 25.0142 22.5199 26.321C21.6297 27.6184 20.3419 28.6269 18.6562 29.3466C16.9801 30.0568 14.9583 30.4119 12.5909 30.4119C10.2424 30.4119 8.19697 30.0521 6.45455 29.3324C4.72159 28.6127 3.36742 27.5473 2.39205 26.1364C1.42614 24.7159 0.919508 22.9593 0.872159 20.8665H6.82386C6.89015 21.8419 7.16951 22.6562 7.66193 23.3097C8.16383 23.9536 8.83144 24.4413 9.66477 24.7727C10.5076 25.0947 11.4593 25.2557 12.5199 25.2557C13.5616 25.2557 14.4659 25.1042 15.233 24.8011C16.0095 24.4981 16.6108 24.0767 17.0369 23.5369C17.4631 22.9972 17.6761 22.3769 17.6761 21.6761C17.6761 21.0227 17.482 20.4735 17.0938 20.0284C16.715 19.5833 16.1563 19.2045 15.4176 18.892C14.6884 18.5795 13.7936 18.2955 12.733 18.0398L9.56534 17.2443C7.11269 16.6477 5.17614 15.715 3.75568 14.446C2.33523 13.1771 1.62973 11.4678 1.6392 9.31818C1.62973 7.55682 2.09848 6.01799 3.04545 4.7017C4.00189 3.38542 5.31345 2.35795 6.98011 1.61932C8.64678 0.880681 10.5407 0.511363 12.6619 0.511363C14.821 0.511363 16.7055 0.880681 18.3153 1.61932C19.9347 2.35795 21.1941 3.38542 22.0938 4.7017C22.9934 6.01799 23.4574 7.54261 23.4858 9.27557H17.5909Z"
                  className="fill-primary"
                />
                <path
                  d="M26.9126 5.98011V0.90909H50.8047V5.98011H41.8984V30H35.8189V5.98011H26.9126Z"
                  className="fill-primary"
                />
                <path
                  d="M54.7393 30V0.90909H66.2166C68.4136 0.90909 70.2886 1.30208 71.8416 2.08807C73.4041 2.86458 74.5926 3.9678 75.407 5.39773C76.2308 6.81818 76.6428 8.48958 76.6428 10.4119C76.6428 12.3437 76.2261 14.0057 75.3928 15.3977C74.5594 16.7803 73.352 17.8409 71.7706 18.5795C70.1986 19.3182 68.2952 19.6875 66.0604 19.6875H58.3757V14.7443H65.0661C66.2403 14.7443 67.2157 14.5833 67.9922 14.2614C68.7687 13.9394 69.3464 13.4564 69.7251 12.8125C70.1134 12.1686 70.3075 11.3684 70.3075 10.4119C70.3075 9.44602 70.1134 8.63163 69.7251 7.96875C69.3464 7.30587 68.764 6.80398 67.978 6.46307C67.2015 6.11269 66.2214 5.9375 65.0376 5.9375H60.8899V30H54.7393Z"
                  className="fill-primary"
                />
                <path
                  d="M70.4496 16.7614L77.6797 30H70.8899L63.8161 16.7614H70.4496Z"
                  className="fill-primary"
                />
                <path
                  d="M107.2 0.90909H114.786L122.797 20.4545H123.138L131.149 0.90909H138.734V30H132.768V11.0653H132.527L124.999 29.858H120.936L113.408 10.9943H113.166V30H107.2V0.90909Z"
                  className="fill-primary"
                />
                <path
                  d="M143.802 30V0.90909H163.404V5.98011H149.952V12.9119H162.396V17.983H149.952V24.929H163.461V30H143.802Z"
                  className="fill-primary"
                />

                <path
                  d="M81.6143 30V25.071H101.501V30H81.6143ZM84.0433 17.6847V12.9261H99.1712V17.6847H84.0433ZM82.1541 5.90909V0.90909H100.592V5.90909H82.1541Z"
                  className="fill-secondary"
                />
              </svg>
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
                    {address ? truncateAddress(address) : isLoading ? "Connecting..." : "No Address"}
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
              <button onClick={connect} className="btn btn-ghost" disabled={isLoading}>
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
