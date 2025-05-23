"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TokenActions } from "./TokenActions";
import { Token } from "@/src/app/types/token";
import { TokenInfo } from "./TokenInfo";
import { StakedBalance } from "@/src/components/StakedBalance";
import { ClaimFeesButton } from "@/src/components/ClaimFeesButton";
import { publicClient } from "@/src/lib/viemClient";
import { LP_FACTORY_ADDRESS, LP_FACTORY_ABI } from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { Button } from "@/src/components/ui/button";
import { base } from "wagmi/chains";
import sdk from "@farcaster/frame-sdk";
import { HeroAnimationMini } from "@/src/components/HeroAnimationMini";

type Deployment = {
  token: string;
  locker: string;
  positionId: bigint;
};

export function TokenPageContent() {
  const params = useParams();
  const pageAddress = params.address as string;
  const [token, setToken] = useState<Token | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  const {
    isSDKLoaded,
    isMiniAppView,
    address,
    isConnected,
    isOnCorrectNetwork,
    connect,
    connectors,
    switchChain,
    isSwitchingChain,
  } = useAppFrameLogic();

  useEffect(() => {
    async function fetchToken() {
      try {
        const response = await fetch(
          `/api/tokens/single?address=${pageAddress}`
        );
        const data = await response.json();
        if (data.data) {
          setToken(data.data);
        }
      } catch (error) {
        console.error("Error fetching token:", error);
      } finally {
        setTokenLoading(false);
      }
    }

    fetchToken();
  }, [pageAddress]);

  useEffect(() => {
    if (!address || !token || !isConnected) {
      setIsCreator(false);
      return;
    }

    const checkIsCreator = async () => {
      try {
        const deployments = (await publicClient.readContract({
          address: LP_FACTORY_ADDRESS,
          abi: LP_FACTORY_ABI,
          functionName: "getTokensDeployedByUser",
          args: [address as `0x${string}`],
        })) as Deployment[];

        const isCreatorResult = deployments.some(
          (d) => d.token.toLowerCase() === token.contract_address.toLowerCase()
        );
        setIsCreator(isCreatorResult);
      } catch (error) {
        console.error("Error checking creator status:", error);
        setIsCreator(false);
      }
    };

    checkIsCreator();
  }, [address, token, isConnected]);

  const handleStakingChange = () => {
    const stakedBalanceElement = document.querySelector(
      "[data-staking-balance]"
    );
    if (stakedBalanceElement) {
      stakedBalanceElement.dispatchEvent(new Event("refresh"));
    }
  };

  const handleShare = async () => {
    if (!token) return;

    // Format price for sharing - avoid scientific notation
    const formatPriceForShare = (price: number | undefined) => {
      if (!price || isNaN(price)) return "N/A";

      if (price < 0.01 && price > 0) {
        const decimalStr = price.toFixed(20).split(".")[1];
        let zeroCount = 0;
        while (decimalStr[zeroCount] === "0") {
          zeroCount++;
        }
        return `$0.0${zeroCount}${decimalStr.slice(zeroCount, zeroCount + 4)}`;
      }

      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })}`;
    };

    // Format 24h change same as in TokenInfo.tsx
    const format24hChange = (change24h: number | undefined) => {
      if (change24h === undefined || change24h === null) return "";
      const sign = change24h >= 0 ? "+" : "";
      return `${sign}${change24h.toFixed(2)}%`;
    };

    const shareUrl = `https://streme.fun/token/${pageAddress}`;
    const change24hText =
      token.change24h !== undefined
        ? `\n24h: ${format24hChange(token.change24h)}`
        : "";

    const castText = `Check out $${
      token.symbol
    } on Streme! 🚀\n\nPrice: ${formatPriceForShare(
      token.price
    )}\nMarket Cap: $${parseFloat(
      token.marketCap?.toString() || "0"
    ).toLocaleString()}${change24hText}\n\n${shareUrl}`;

    if (isMiniAppView && isSDKLoaded && sdk) {
      try {
        await sdk.actions.composeCast({
          text: castText,
          embeds: [shareUrl],
        });
      } catch (error) {
        console.error("Error composing cast:", error);
        // Fallback to opening Farcaster
        window.open(
          `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
            castText
          )}&embeds[]=${encodeURIComponent(shareUrl)}`,
          "_blank"
        );
      }
    } else {
      // Desktop version - open Farcaster web compose
      window.open(
        `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
          castText
        )}&embeds[]=${encodeURIComponent(shareUrl)}`,
        "_blank"
      );
    }
  };

  if (!isSDKLoaded) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="loading loading-bars loading-lg text-primary">
            Loading SDK...
          </div>
        </div>
      </div>
    );
  }

  if (isMiniAppView) {
    if (!isConnected) {
      return (
        <div className="font-[family-name:var(--font-geist-sans)] flex flex-col items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <svg
              width="106"
              height="15"
              viewBox="0 0 212 31"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
                d="M168.741 30.1847C168.273 30.1847 167.87 30.0189 167.534 29.6875C167.203 29.3513 167.037 28.9489 167.037 28.4801C167.037 28.0161 167.203 27.6184 167.534 27.2869C167.87 26.9555 168.273 26.7898 168.741 26.7898C169.196 26.7898 169.594 26.9555 169.935 27.2869C170.276 27.6184 170.446 28.0161 170.446 28.4801C170.446 28.7926 170.366 29.0791 170.205 29.3395C170.048 29.5952 169.842 29.8011 169.587 29.9574C169.331 30.1089 169.049 30.1847 168.741 30.1847Z"
                className="fill-primary"
              />
              <path
                d="M172.987 30V15.4545H182.618V17.9901H176.062V21.456H181.978V23.9915H176.062V30H172.987Z"
                className="fill-accent"
              />
              <path
                d="M193.67 15.4545H196.746V24.9006C196.746 25.9612 196.492 26.8892 195.986 27.6847C195.484 28.4801 194.781 29.1004 193.876 29.5455C192.972 29.9858 191.919 30.206 190.716 30.206C189.509 30.206 188.453 29.9858 187.548 29.5455C186.644 29.1004 185.941 28.4801 185.439 27.6847C184.937 26.8892 184.686 25.9612 184.686 24.9006V15.4545H187.761V24.6378C187.761 25.1918 187.882 25.6842 188.124 26.1151C188.37 26.5459 188.715 26.8845 189.161 27.1307C189.606 27.3769 190.124 27.5 190.716 27.5C191.313 27.5 191.831 27.3769 192.271 27.1307C192.716 26.8845 193.06 26.5459 193.301 26.1151C193.547 25.6842 193.67 25.1918 193.67 24.6378V15.4545Z"
                className="fill-accent"
              />
              <path
                d="M211.442 15.4545V30H208.786L202.458 20.8452H202.351V30H199.276V15.4545H201.975L208.253 24.6023H208.381V15.4545H211.442Z"
                className="fill-accent"
              />
              <path
                d="M81.6143 30V25.071H101.501V30H81.6143ZM84.0433 17.6847V12.9261H99.1712V17.6847H84.0433ZM82.1541 5.90909V0.90909H100.592V5.90909H82.1541Z"
                className="fill-secondary"
              />
            </svg>
            <h1 className="text-xl font-bold">Farcaster Mini-App</h1>
          </div>
          <Button onClick={() => connect({ connector: connectors[0] })}>
            Connect Wallet to View Token
          </Button>
          <div className="fixed inset-0 -z-50">
            <HeroAnimationMini />
          </div>
        </div>
      );
    }
    if (!isOnCorrectNetwork) {
      return (
        <div className="font-[family-name:var(--font-geist-sans)] flex flex-col items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <svg
              width="106"
              height="15"
              viewBox="0 0 212 31"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
                d="M168.741 30.1847C168.273 30.1847 167.87 30.0189 167.534 29.6875C167.203 29.3513 167.037 28.9489 167.037 28.4801C167.037 28.0161 167.203 27.6184 167.534 27.2869C167.87 26.9555 168.273 26.7898 168.741 26.7898C169.196 26.7898 169.594 26.9555 169.935 27.2869C170.276 27.6184 170.446 28.0161 170.446 28.4801C170.446 28.7926 170.366 29.0791 170.205 29.3395C170.048 29.5952 169.842 29.8011 169.587 29.9574C169.331 30.1089 169.049 30.1847 168.741 30.1847Z"
                className="fill-primary"
              />
              <path
                d="M172.987 30V15.4545H182.618V17.9901H176.062V21.456H181.978V23.9915H176.062V30H172.987Z"
                className="fill-accent"
              />
              <path
                d="M193.67 15.4545H196.746V24.9006C196.746 25.9612 196.492 26.8892 195.986 27.6847C195.484 28.4801 194.781 29.1004 193.876 29.5455C192.972 29.9858 191.919 30.206 190.716 30.206C189.509 30.206 188.453 29.9858 187.548 29.5455C186.644 29.1004 185.941 28.4801 185.439 27.6847C184.937 26.8892 184.686 25.9612 184.686 24.9006V15.4545H187.761V24.6378C187.761 25.1918 187.882 25.6842 188.124 26.1151C188.37 26.5459 188.715 26.8845 189.161 27.1307C189.606 27.3769 190.124 27.5 190.716 27.5C191.313 27.5 191.831 27.3769 192.271 27.1307C192.716 26.8845 193.06 26.5459 193.301 26.1151C193.547 25.6842 193.67 25.1918 193.67 24.6378V15.4545Z"
                className="fill-accent"
              />
              <path
                d="M211.442 15.4545V30H208.786L202.458 20.8452H202.351V30H199.276V15.4545H201.975L208.253 24.6023H208.381V15.4545H211.442Z"
                className="fill-accent"
              />
              <path
                d="M81.6143 30V25.071H101.501V30H81.6143ZM84.0433 17.6847V12.9261H99.1712V17.6847H84.0433ZM82.1541 5.90909V0.90909H100.592V5.90909H82.1541Z"
                className="fill-secondary"
              />
            </svg>
            <h1 className="text-xl font-bold">Farcaster Mini-App</h1>
          </div>
          <p className="text-sm mb-2">Connected: {address}</p>
          <Button
            onClick={() => switchChain && switchChain({ chainId: base.id })}
            disabled={isSwitchingChain || !switchChain}
          >
            {isSwitchingChain
              ? "Switching to Base..."
              : "Switch to Base Network to View Token"}
          </Button>
          <div className="fixed inset-0 -z-10">
            <HeroAnimationMini />
          </div>
        </div>
      );
    }
  }

  if (tokenLoading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="loading loading-bars loading-lg text-primary"></div>
        </div>
      </div>
    );
  }

  if (!token) {
    return <div className="text-center py-8">Token not found</div>;
  }

  const embedUrl =
    pageAddress.toLowerCase() ===
    "0x1234567890123456789012345678901234567890".toLowerCase()
      ? "https://www.geckoterminal.com/base/pools/0x1035ae3f87a91084c6c5084d0615cc6121c5e228?embed=1&info=0&swaps=1&grayscale=0&light_chart=1"
      : `https://www.geckoterminal.com/base/pools/${token.pool_address}?embed=1&info=0&swaps=1&grayscale=0&light_chart=1`;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 lg:mt-20 pt-8 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        <div className="order-1 lg:order-2 lg:col-span-4 space-y-4">
          <TokenInfo
            token={token}
            onShare={handleShare}
            isMiniAppView={isMiniAppView}
          />

          <TokenActions
            token={token}
            onStakingChange={handleStakingChange}
            isMiniAppView={isMiniAppView}
            address={address}
            isConnected={isConnected}
            isOnCorrectNetwork={isOnCorrectNetwork}
          />
          <StakedBalance
            data-staking-balance
            stakingAddress={token.staking_address}
            stakingPool={token.staking_pool}
            symbol={token.symbol}
            tokenAddress={token.contract_address}
            isMiniApp={isMiniAppView}
            farcasterAddress={address}
            farcasterIsConnected={isConnected}
          />
          {isConnected && (
            <ClaimFeesButton
              tokenAddress={token.contract_address}
              creatorAddress={isCreator ? address : undefined}
            />
          )}
        </div>

        <div className="order-2 lg:order-1 lg:col-span-8 card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
          <div className="card-body p-4 pb-12">
            <iframe
              data-privy-ignore
              title="GeckoTerminal Embed"
              src={embedUrl}
              className="w-full h-[500px] lg:h-[800px]"
              allow="clipboard-write"
              allowFullScreen
            />
          </div>
        </div>
      </div>
      <div className="fixed inset-0 -z-50">
        <HeroAnimationMini />
      </div>
    </div>
  );
}
