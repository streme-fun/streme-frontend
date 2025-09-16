"use client";

import { useState, useEffect } from "react";
import { useSafeWalletAuth } from "../hooks/useSafeWallet";
import { formatEther } from "viem";
import { publicClient } from "@/src/lib/viemClient";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import Image from "next/image";
import { Copy, X, Check } from "lucide-react";
import { toast } from "sonner";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface WalletProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  preloadedUserData?: {
    displayName: string;
    username: string;
    profileImage: string;
  } | null;
}

// STREME token contract details from the provided data
const STREME_TOKEN_ADDRESS =
  "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as const;
const STREME_DECIMALS = 18;

const erc20ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Client-side function to fetch user data from our API
const fetchNeynarUser = async (fid: number) => {
  try {
    const response = await fetch(`/api/neynar/user/${fid}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching user from API:", error);
    return null;
  }
};

export function WalletProfileModal({
  isOpen,
  onClose,
  preloadedUserData,
}: WalletProfileModalProps) {
  const { user: connectedUser } = useSafeWalletAuth();
  const {
    farcasterContext,
    isMiniAppView,
    address: fcAddress,
  } = useAppFrameLogic();

  const [ethBalance, setEthBalance] = useState<bigint>(0n);
  const [stremeBalance, setStremeBalance] = useState<bigint>(0n);
  const [profileImage, setProfileImage] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Get effective address and FID based on mini-app context
  const effectiveAddress = isMiniAppView
    ? fcAddress
    : connectedUser?.wallet?.address;

  // Try multiple possible paths for FID based on SDK documentation
  const userFid =
    farcasterContext?.user?.fid ||
    (farcasterContext as unknown as { client?: { user?: { fid?: number } } })
      ?.client?.user?.fid;

  // Copy address to clipboard with visual feedback
  const copyAddress = async () => {
    if (effectiveAddress) {
      await navigator.clipboard.writeText(effectiveAddress);
      setIsCopied(true);
      toast.success("Address copied to clipboard!");

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  };

  // Fetch user profile from Neynar API or use preloaded data
  useEffect(() => {
    const fetchUserProfile = async () => {
      // Use preloaded data if available (mini-app mode optimization)
      if (isMiniAppView && preloadedUserData) {
        setDisplayName(preloadedUserData.displayName);
        setUsername(preloadedUserData.username);
        setProfileImage(preloadedUserData.profileImage);
        return;
      }

      // Fallback to fetching if no preloaded data or not in mini-app
      if (!userFid) {
        setDisplayName("Anonymous User");
        setUsername("");
        setProfileImage("");
        return;
      }

      try {
        const neynarUser = await fetchNeynarUser(userFid);
        if (neynarUser) {
          setDisplayName(
            neynarUser.display_name || neynarUser.username || "Anonymous User"
          );
          setUsername(neynarUser.username || "");
          setProfileImage(neynarUser.pfp_url || "");
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setDisplayName("Anonymous User");
        setUsername("");
        setProfileImage("");
      }
    };

    if (isOpen) {
      fetchUserProfile();
    }
  }, [userFid, isOpen, isMiniAppView, preloadedUserData]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!effectiveAddress || !isOpen) {
        setEthBalance(0n);
        setStremeBalance(0n);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch ETH balance
        const ethBal = await publicClient.getBalance({
          address: effectiveAddress as `0x${string}`,
        });
        setEthBalance(ethBal);

        // Fetch STREME balance
        const stremeBal = await publicClient.readContract({
          address: STREME_TOKEN_ADDRESS,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [effectiveAddress as `0x${string}`],
        });
        setStremeBalance(stremeBal as bigint);
      } catch (error) {
        console.error("Error fetching balances:", error);
        setEthBalance(0n);
        setStremeBalance(0n);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [effectiveAddress, isOpen]);

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: bigint, decimals: number, symbol: string) => {
    const formatted = formatEther(balance);
    const num = parseFloat(formatted);

    if (num === 0) return `0 ${symbol}`;
    if (num < 0.0001) return `<0.0001 ${symbol}`;

    return `${num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })} ${symbol}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-base-100 rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h3 className="text-lg font-semibold text-base-content">Profile</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-base-200 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} className="text-base-content/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile Section */}
          <div className="flex items-center space-x-4">
            {/* Profile Picture */}
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-base-200">
              {profileImage ? (
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
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h4 className="font-semibold text-base-content">{displayName}</h4>
              {username && (
                <p className="text-sm text-base-content/70">@{username}</p>
              )}
              {userFid && (
                <p className="text-xs text-base-content/50">FID: {userFid}</p>
              )}
            </div>
          </div>

          {/* Wallet Address */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-base-content/80">
              Wallet Address
            </label>
            <div className="flex items-center space-x-2 p-3 bg-base-200 rounded-lg">
              <code className="flex-1 text-sm font-mono text-base-content">
                {effectiveAddress
                  ? truncateAddress(effectiveAddress)
                  : "Not connected"}
              </code>
              {effectiveAddress && (
                <button
                  onClick={copyAddress}
                  className={`p-2 rounded-md transition-all duration-200 ${
                    isCopied
                      ? "bg-success/20 text-success"
                      : "hover:bg-base-300 text-base-content/60"
                  }`}
                  title={isCopied ? "Copied!" : "Copy address"}
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="">
            <a
              href="/launched-tokens"
              onClick={onClose}
              className="btn btn-sm btn-outline"
            >
              View Launched Tokens
            </a>
          </div>

          {/* Theme Switcher */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-base-content/80">
              Theme
            </label>
            <ThemeSwitcher className="justify-start" />
          </div>

          {/* Balances */}
          <div className="space-y-4">
            <h5 className="font-medium text-base-content">Balances</h5>

            {isLoading ? (
              <div className="space-y-3">
                <div className="animate-pulse">
                  <div className="h-4 bg-base-300 rounded w-1/2 mb-2"></div>
                  <div className="h-6 bg-base-300 rounded"></div>
                </div>
                <div className="animate-pulse">
                  <div className="h-4 bg-base-300 rounded w-1/2 mb-2"></div>
                  <div className="h-6 bg-base-300 rounded"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* ETH Balance */}
                <div className="flex justify-between items-center p-3 bg-base-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 relative">
                      <Image
                        src="/eth.webp"
                        alt="Ethereum"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className="font-medium text-base-content text-xs">
                      ETH
                    </span>
                  </div>
                  <span className="font-mono text-base-content text-xs">
                    {formatBalance(ethBalance, 18, "ETH")}
                  </span>
                </div>

                {/* STREME Balance */}
                <div className="flex justify-between items-center p-3 bg-base-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 relative">
                      <Image
                        src="/icon-transparent.png"
                        alt="Streme"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className="font-medium text-base-content text-xs">
                      $STREME
                    </span>
                  </div>
                  <span className="font-mono text-base-content text-xs">
                    {formatBalance(stremeBalance, STREME_DECIMALS, "STREME")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
