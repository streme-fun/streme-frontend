"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useAppFrameLogic } from "../hooks/useAppFrameLogic";
import sdk from "@farcaster/miniapp-sdk";
import Image from "next/image";
import FarcasterIcon from "@/public/farcaster.svg";
import { useSafeWallets } from "../hooks/useSafeWallet";
import { Interface } from "@ethersproject/abi";
import { publicClient } from "../lib/viemClient";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { POSTHOG_EVENTS, ANALYTICS_PROPERTIES } from "../lib/analytics";
import confetti from "canvas-confetti";

interface UnstakedToken {
  tokenAddress: string;
  symbol: string;
  balance: number;
  stakingAddress?: string;
  logo?: string;
  marketData?: {
    marketCap: number;
    price: number;
    priceChange24h: number;
  };
}

interface UnstakedTokensModalProps {
  unstakedTokens: UnstakedToken[];
  onDismiss: () => void;
}

// Contract addresses
const STAKING_MACRO_V2 = "0xFA4f84eEC83786d37C5B904e3631412c3b726a20";
const MACRO_FORWARDER = "0xFD0268E33111565dE546af2675351A4b1587F89F";

// ABIs for the contracts
const stakingMacroABI = [
  {
    inputs: [{ name: "tokens", type: "address[]" }],
    name: "getParams",
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const toHex = (address: string) => address as `0x${string}`;

export function UnstakedTokensModal({
  unstakedTokens,
  onDismiss,
}: UnstakedTokensModalProps) {
  const { wallets } = useSafeWallets();
  const { address: wagmiAddress } = useAccount();
  const {
    isMiniAppView,
    address: fcAddress,
    isConnected: fcIsConnected,
    isSDKLoaded: isDetectionComplete,
  } = useAppFrameLogic();
  const postHog = usePostHog();

  const effectiveAddress = isMiniAppView ? fcAddress : wagmiAddress;
  const effectiveIsConnected = isMiniAppView ? fcIsConnected : !!wagmiAddress;

  const [, setIsOpen] = useState(false);
  const [shouldShowModal, setShouldShowModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setCurrentProgress] = useState({
    current: 0,
    total: 0,
  });

  useEffect(() => {
    // Wait for detection to complete and connection to be stable
    if (!isDetectionComplete) {
      console.log("UnstakedTokensModal: Waiting for detection to complete");
      return;
    }

    if (!effectiveAddress || !effectiveIsConnected) {
      console.log("UnstakedTokensModal: No address or not connected", {
        effectiveAddress,
        effectiveIsConnected,
      });
      return;
    }

    // Additional validation for mini app
    if (
      isMiniAppView &&
      (!effectiveAddress.startsWith("0x") || effectiveAddress.length !== 42)
    ) {
      console.log("UnstakedTokensModal: Invalid mini app address format", {
        effectiveAddress,
      });
      return;
    }

    // Check if user has dismissed the modal in this session
    const hasSeenModal = sessionStorage.getItem("unstakedTokensModalDismissed");
    if (hasSeenModal === "true") {
      console.log("UnstakedTokensModal: Already dismissed this session");
      return;
    }

    // Only show if there are unstaked tokens with staking addresses
    const hasStakableTokens = unstakedTokens.some(
      (token) =>
        token.stakingAddress &&
        token.stakingAddress !== "" &&
        token.stakingAddress !== "0x0000000000000000000000000000000000000000" &&
        token.balance > 0
    );

    console.log("UnstakedTokensModal: Check complete", {
      hasStakableTokens,
      unstakedTokensCount: unstakedTokens.length,
      effectiveAddress,
      isMiniAppView,
      timestamp: new Date().toISOString(),
    });

    if (hasStakableTokens) {
      setShouldShowModal(true);
      // Shorter delay since we now have stable detection
      setTimeout(() => {
        setIsOpen(true);
      }, 1000);
    }
  }, [
    effectiveAddress,
    effectiveIsConnected,
    unstakedTokens,
    isDetectionComplete,
    isMiniAppView,
  ]);

  const handleDismiss = () => {
    sessionStorage.setItem("unstakedTokensModalDismissed", "true");
    handleClose();
  };

  const { isSDKLoaded } = useAppFrameLogic();

  const handleShare = async () => {
    const shareText = `I just staked my tokens on Streme for rewards streamed to my wallet every second. Stake it to make it!

https://streme.fun`;

    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: shareText,
          embeds: ["https://streme.fun"],
        });
      } catch (error) {
        console.error("Error composing cast:", error);
        // Fallback to opening Farcaster
        window.open(
          `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
            shareText
          )}&embeds[]=${encodeURIComponent("https://streme.fun")}`,
          "_blank"
        );
      }
    } else {
      // Desktop version - open Farcaster web compose
      window.open(
        `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
          shareText
        )}&embeds[]=${encodeURIComponent("https://streme.fun")}`,
        "_blank"
      );
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsSuccess(false);
    onDismiss();
  };

  const handleStakeSuccess = () => {
    setIsSuccess(true);
    // Trigger confetti animation
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.4 },
      colors: [
        "#2563eb",
        "#7c3aed",
        "#10b981",
        "#ec4899",
        "#f59e0b",
        "#06b6d4",
      ],
      startVelocity: 30,
      gravity: 0.5,
      ticks: 60,
      shapes: ["circle", "square"],
      scalar: 1.2,
    });
  };

  const handleStakeClick = async () => {
    if (!effectiveAddress || !effectiveIsConnected) {
      toast.error("Wallet not connected");
      return;
    }

    // Filter to only stakable tokens
    const stakesToProcess = stakableTokens.map((token) => ({
      tokenAddress: token.tokenAddress,
      stakingAddress: token.stakingAddress!,
      stakingPoolAddress: "", // These are unstaked tokens, no existing pool
      symbol: token.symbol,
      balance: BigInt(Math.floor(token.balance * 1e18)),
    }));

    if (stakesToProcess.length === 0) {
      toast.error("No tokens available to stake");
      return;
    }

    setIsLoading(true);
    setCurrentProgress({ current: 0, total: 1 });
    const toastId = toast.loading("Preparing staking operation...");

    try {
      // Get provider
      let provider: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      let userAddress: string;

      if (isMiniAppView) {
        provider = await sdk.wallet.getEthereumProvider();
        if (!provider) {
          throw new Error("Farcaster Ethereum provider not available");
        }
        userAddress = effectiveAddress!;
      } else {
        if (!wagmiAddress) {
          throw new Error("Wagmi wallet not connected");
        }
        userAddress = wagmiAddress;
        const wallet = wallets.find((w) => w.address === wagmiAddress);
        if (!wallet) {
          throw new Error("Wallet not found");
        }
        provider = await wallet.getEthereumProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      }

      // Execute batch staking operation
      setCurrentProgress({ current: 1, total: 1 });
      toast.loading("Executing staking operation...", { id: toastId });

      const tokenAddresses = stakesToProcess.map((stake) => stake.tokenAddress);
      const uniqueTokens = [...new Set(tokenAddresses)];

      // Get encoded parameters from StakingMacroV2
      const encodedAddresses = await publicClient.readContract({
        address: toHex(STAKING_MACRO_V2),
        abi: stakingMacroABI,
        functionName: "getParams",
        args: [uniqueTokens.map((addr) => toHex(addr))],
      });

      // Execute the macro via MacroForwarder
      const macroIface = new Interface([
        "function runMacro(address macro, bytes calldata params) external",
      ]);
      const macroData = macroIface.encodeFunctionData("runMacro", [
        toHex(STAKING_MACRO_V2),
        encodedAddresses,
      ]);

      const macroTxParams: Record<string, unknown> = {
        to: toHex(MACRO_FORWARDER),
        from: toHex(userAddress),
        data: toHex(macroData),
        chainId: "0x2105", // Base mainnet chain ID (8453 in hex)
      };

      // Add gas estimation for non-miniApp
      if (!isMiniAppView) {
        try {
          const estimatedGas = await publicClient.estimateGas({
            account: userAddress as `0x${string}`,
            to: toHex(MACRO_FORWARDER),
            data: macroData as `0x${string}`,
          });
          const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.5));
          macroTxParams.gas = `0x${gasLimit.toString(16)}`;
        } catch {
          console.warn("Gas estimation failed, proceeding without limit");
        }
      }

      const macroTxHash = await provider.request({
        method: "eth_sendTransaction",
        params: [macroTxParams],
      });

      if (!macroTxHash) {
        throw new Error("Staking operation was cancelled");
      }

      const macroReceipt = await publicClient.waitForTransactionReceipt({
        hash: macroTxHash as `0x${string}`,
      });

      if (macroReceipt.status !== "success") {
        throw new Error("Staking operation failed");
      }

      // Success!
      toast.success(
        `Successfully staked ${stakesToProcess.length} ${
          stakesToProcess.length === 1 ? "token" : "tokens"
        }!`,
        { id: toastId }
      );

      // Auto-dismiss the success toast after 4 seconds
      setTimeout(() => {
        toast.dismiss(toastId);
      }, 4000);

      // PostHog event tracking
      postHog.capture(POSTHOG_EVENTS.TOP_UP_ALL_STAKES_SUCCESS, {
        [ANALYTICS_PROPERTIES.TOTAL_TOKENS_COUNT]: stakesToProcess.length,
        [ANALYTICS_PROPERTIES.USER_ADDRESS]: effectiveAddress,
        [ANALYTICS_PROPERTIES.IS_MINI_APP]: isMiniAppView || false,
        [ANALYTICS_PROPERTIES.TRANSACTION_HASH]: macroTxHash,
        [ANALYTICS_PROPERTIES.WALLET_TYPE]: isMiniAppView
          ? "farcaster"
          : "wagmi",
        token_addresses: stakesToProcess
          .map((stake) => stake.tokenAddress)
          .join(","),
        token_symbols: stakesToProcess.map((stake) => stake.symbol).join(","),
        total_balance_wei: stakesToProcess
          .reduce((sum, stake) => sum + stake.balance, 0n)
          .toString(),
      });

      handleStakeSuccess();
    } catch (error) {
      console.error("Staking operation failed:", error);
      let message = "Failed to complete staking operation";

      if (error instanceof Error) {
        if (
          error.message.includes("cancelled") ||
          error.message.includes("rejected")
        ) {
          message = "Operation cancelled by user";
        } else {
          message = error.message;
        }
      }

      toast.error(message, { id: toastId });
    } finally {
      setIsLoading(false);
      setCurrentProgress({ current: 0, total: 0 });
    }
  };

  // Filter to only show stakable tokens
  const stakableTokens = unstakedTokens.filter(
    (token) =>
      token.stakingAddress &&
      token.stakingAddress !== "" &&
      token.stakingAddress !== "0x0000000000000000000000000000000000000000" &&
      token.balance > 0
  );

  if (!shouldShowModal || stakableTokens.length === 0) {
    return null;
  }

  // Success screen
  if (isSuccess) {
    if (isMiniAppView) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-base-100 rounded-xl shadow-xl w-full max-w-sm animate-in zoom-in duration-300">
            <div className="p-4 space-y-3">
              {/* X button */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 btn btn-ghost btn-sm btn-circle"
              >
                ✕
              </button>
              <h3 className="text-lg font-bold">Staking Complete! 🎉</h3>
              <div className="relative h-24 w-full overflow-hidden rounded-lg">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 400 100"
                  preserveAspectRatio="xMidYMid meet"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 50 Q100 50 200 50 T400 50"
                    stroke="hsl(220 13% 91%)"
                    strokeWidth="2"
                  />
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.2s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.4s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.6s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.8s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                </svg>
                <style jsx>{`
                  .reward-particle {
                    animation: flow 2s linear infinite;
                  }
                  @keyframes flow {
                    from {
                      offset-distance: 0%;
                    }
                    to {
                      offset-distance: 100%;
                    }
                  }
                `}</style>
              </div>
              <p className="text-center text-sm pb-4">
                Rewards are now streaming to your wallet every second.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="btn btn-outline flex-1"
                >
                  <Image
                    src={FarcasterIcon}
                    alt="Share on Farcaster"
                    width={16}
                    height={16}
                    className="opacity-90"
                  />
                  Share on Farcaster
                </button>
              </div>
              <button onClick={handleClose} className="btn btn-ghost w-full">
                Explore
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-base-100 rounded-xl shadow-xl w-full max-w-sm animate-in zoom-in duration-300">
            <div className="p-4 space-y-3">
              {/* X button */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 btn btn-ghost btn-sm btn-circle"
              >
                ✕
              </button>
              <h3 className="text-lg font-bold">Staking Complete! 🎉</h3>
              <div className="relative h-24 w-full overflow-hidden rounded-lg">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 400 100"
                  preserveAspectRatio="xMidYMid meet"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 50 Q100 50 200 50 T400 50"
                    stroke="hsl(220 13% 91%)"
                    strokeWidth="2"
                  />
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.2s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.4s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.6s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                  <g
                    className="reward-particle"
                    style={{
                      offsetPath: "path('M0 50 Q100 50 200 50 T400 50')",
                      animationDelay: "-0.8s",
                    }}
                  >
                    <circle
                      r="4"
                      fill="currentColor"
                      className="text-primary"
                    />
                  </g>
                </svg>
                <style jsx>{`
                  .reward-particle {
                    animation: flow 2s linear infinite;
                  }
                  @keyframes flow {
                    from {
                      offset-distance: 0%;
                    }
                    to {
                      offset-distance: 100%;
                    }
                  }
                `}</style>
              </div>
              <p className="text-center text-sm pb-4">
                Rewards are now streaming to your wallet every second.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="btn btn-primary flex-1"
                >
                  <Image
                    src={FarcasterIcon}
                    alt="Share on Farcaster"
                    width={16}
                    height={16}
                    className="opacity-90"
                  />
                  Share & Explore
                </button>
              </div>
              <button onClick={handleClose} className="btn btn-ghost w-full">
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Main modal - floating in center
  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={handleDismiss} />
        <div className="relative bg-base-100 rounded-xl shadow-xl w-full max-w-sm animate-in zoom-in duration-300">
          <div className="p-4">
            {/* X button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 btn btn-ghost btn-sm btn-circle"
            >
              ✕
            </button>

            <div className="text-center mb-4 pt-2">
              <div className="w-16 h-16 mx-auto mb-3 relative">
                <svg
                  width="64"
                  height="64"
                  viewBox="-4 -4 72 72"
                  className="animate-pulse"
                >
                  <style jsx>{`
                    @keyframes containerShake {
                      0%,
                      100% {
                        transform: scale(1) rotate(0deg);
                        opacity: 0.8;
                      }
                      25% {
                        transform: scale(1.03) rotate(1.2deg);
                        opacity: 0.9;
                      }
                      50% {
                        transform: scale(1.05) rotate(-1.5deg);
                        opacity: 1;
                      }
                      75% {
                        transform: scale(1.02) rotate(0.8deg);
                        opacity: 0.9;
                      }
                    }

                    @keyframes chaoticFlow1 {
                      from {
                        offset-distance: 0%;
                      }
                      to {
                        offset-distance: 100%;
                      }
                    }

                    @keyframes chaoticFlow2 {
                      from {
                        offset-distance: 100%;
                      }
                      to {
                        offset-distance: 0%;
                      }
                    }

                    @keyframes erraticPulse {
                      0% {
                        transform: scale(1);
                      }
                      15% {
                        transform: scale(1.3);
                      }
                      30% {
                        transform: scale(0.8);
                      }
                      45% {
                        transform: scale(1.2);
                      }
                      60% {
                        transform: scale(0.9);
                      }
                      75% {
                        transform: scale(1.4);
                      }
                      90% {
                        transform: scale(0.7);
                      }
                      100% {
                        transform: scale(1);
                      }
                    }

                    .trapped-container {
                      animation: containerShake 1.8s ease-in-out infinite;
                    }

                    .chaotic-particle-1 {
                      animation: chaoticFlow1 1.2s linear infinite,
                        erraticPulse 2.1s ease-in-out infinite;
                      animation-delay: 0s, -0.2s;
                    }

                    .chaotic-particle-2 {
                      animation: chaoticFlow2 0.9s linear infinite,
                        erraticPulse 1.7s ease-in-out infinite;
                      animation-delay: -0.1s, -0.5s;
                    }

                    .chaotic-particle-3 {
                      animation: chaoticFlow1 1.6s linear infinite,
                        erraticPulse 2.3s ease-in-out infinite;
                      animation-delay: -0.3s, -0.8s;
                    }

                    .chaotic-particle-4 {
                      animation: chaoticFlow2 1.1s linear infinite,
                        erraticPulse 1.9s ease-in-out infinite;
                      animation-delay: -0.7s, -0.3s;
                    }

                    .chaotic-particle-5 {
                      animation: chaoticFlow1 0.8s linear infinite,
                        erraticPulse 2.5s ease-in-out infinite;
                      animation-delay: -0.4s, -1.1s;
                    }

                    .chaotic-particle-6 {
                      animation: chaoticFlow2 1.4s linear infinite,
                        erraticPulse 1.6s ease-in-out infinite;
                      animation-delay: -0.9s, -0.7s;
                    }

                    .chaotic-particle-7 {
                      animation: chaoticFlow1 1.3s linear infinite,
                        erraticPulse 2.2s ease-in-out infinite;
                      animation-delay: -0.2s, -1.3s;
                    }

                    .chaotic-particle-8 {
                      animation: chaoticFlow2 1s linear infinite,
                        erraticPulse 1.8s ease-in-out infinite;
                      animation-delay: -0.6s, -0.4s;
                    }
                  `}</style>

                  {/* Define clipping mask to keep particles inside */}
                  <defs>
                    <clipPath id="containerClip">
                      <circle cx="32" cy="32" r="28" />
                    </clipPath>
                  </defs>

                  {/* Intensely shaking container - the prison */}
                  <g className="trapped-container">
                    <circle
                      cx="32"
                      cy="32"
                      r="30"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="4"
                      opacity="0.9"
                      strokeDasharray="3 1"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="3"
                      opacity="0.6"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="22"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      opacity="0.4"
                      strokeDasharray="1 1"
                    />
                  </g>

                  {/* Chaotic particles with tails - clipped to stay inside */}
                  <g clipPath="url(#containerClip)">
                    <g
                      className="chaotic-particle-1"
                      style={{
                        offsetPath: "path('M 32 14 A 18 18 0 1 1 31.99 14')",
                      }}
                    >
                      <line
                        x1="-8"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#2563eb"
                        strokeWidth="1.5"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="3.5" fill="#2563eb" />
                    </g>
                    <g
                      className="chaotic-particle-2"
                      style={{
                        offsetPath: "path('M 32 12 A 20 20 0 1 0 31.99 12')",
                      }}
                    >
                      <line
                        x1="-6"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#7c3aed"
                        strokeWidth="1"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="2" fill="#7c3aed" />
                    </g>
                    <g
                      className="chaotic-particle-3"
                      style={{
                        offsetPath: "path('M 32 18 A 14 14 0 1 1 31.99 18')",
                      }}
                    >
                      <line
                        x1="-10"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#10b981"
                        strokeWidth="2"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="4" fill="#10b981" />
                    </g>
                    <g
                      className="chaotic-particle-4"
                      style={{
                        offsetPath: "path('M 32 10 A 22 22 0 1 0 31.99 10')",
                      }}
                    >
                      <line
                        x1="-7"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#ec4899"
                        strokeWidth="1.2"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="2.5" fill="#ec4899" />
                    </g>
                    <g
                      className="chaotic-particle-5"
                      style={{
                        offsetPath: "path('M 32 20 A 12 12 0 1 1 31.99 20')",
                      }}
                    >
                      <line
                        x1="-8"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="3" fill="#f59e0b" />
                    </g>
                    <g
                      className="chaotic-particle-6"
                      style={{
                        offsetPath: "path('M 32 16 A 16 16 0 1 0 31.99 16')",
                      }}
                    >
                      <line
                        x1="-7"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#06b6d4"
                        strokeWidth="1.4"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="2.8" fill="#06b6d4" />
                    </g>
                    <g
                      className="chaotic-particle-7"
                      style={{
                        offsetPath: "path('M 32 13 A 19 19 0 1 1 31.99 13')",
                      }}
                    >
                      <line
                        x1="-9"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#8b5cf6"
                        strokeWidth="1.6"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="3.2" fill="#8b5cf6" />
                    </g>
                    <g
                      className="chaotic-particle-8"
                      style={{
                        offsetPath: "path('M 32 21 A 11 11 0 1 0 31.99 21')",
                      }}
                    >
                      <line
                        x1="-6"
                        y1="0"
                        x2="0"
                        y2="0"
                        stroke="#ef4444"
                        strokeWidth="1.1"
                        opacity="0.6"
                        strokeLinecap="round"
                      />
                      <circle r="2.3" fill="#ef4444" />
                    </g>
                  </g>
                </svg>
              </div>
              <h2 className="text-lg font-bold mb-2">
                You&apos;ve got unstaked Streme tokens!
              </h2>
              <p className="text-sm text-base-content">
                Stake to start receiving rewards streamed to your wallet every
                second.
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {stakableTokens.slice(0, 3).map((token) => (
                <div
                  key={token.tokenAddress}
                  className="flex items-center justify-between py-2 px-3 bg-base-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-base-300 flex items-center justify-center">
                      {token.logo ? (
                        <img
                          src={token.logo}
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            target.nextElementSibling!.classList.remove(
                              "hidden"
                            );
                          }}
                        />
                      ) : null}
                      <div
                        className={`${
                          token.logo ? "hidden" : ""
                        } w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold`}
                      >
                        {token.symbol.charAt(0)}
                      </div>
                    </div>
                    <span className="font-medium text-sm text-base-content">
                      {token.symbol}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-base-content">
                    {token.balance.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
              {stakableTokens.length > 3 && (
                <div className="text-center text-xs text-base-content/50 py-1">
                  +{stakableTokens.length - 3} more tokens
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="btn btn-ghost btn-sm flex-1"
              >
                Later
              </button>
              <button
                onClick={handleStakeClick}
                disabled={isLoading}
                className="btn btn-primary btn-sm flex-1"
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Staking...
                  </>
                ) : (
                  "Stake"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
