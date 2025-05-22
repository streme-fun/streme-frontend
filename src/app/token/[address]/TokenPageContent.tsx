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
    farcasterContext,
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
          <h1 className="text-xl font-bold mb-4">Farcaster Mini-App</h1>
          <Button onClick={() => connect({ connector: connectors[0] })}>
            Connect Wallet to View Token
          </Button>
        </div>
      );
    }
    if (!isOnCorrectNetwork) {
      return (
        <div className="font-[family-name:var(--font-geist-sans)] flex flex-col items-center justify-center h-screen">
          <h1 className="text-xl font-bold mb-4">Farcaster Mini-App</h1>
          <p className="text-sm mb-2">Connected: {address}</p>
          <Button
            onClick={() => switchChain && switchChain({ chainId: base.id })}
            disabled={isSwitchingChain || !switchChain}
          >
            {isSwitchingChain
              ? "Switching to Base..."
              : "Switch to Base Network to View Token"}
          </Button>
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
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {isMiniAppView && (
        <div className="mb-4 text-center">
          <p className="text-sm">Connected: {address}</p>
          <p className="text-sm">
            FID: {farcasterContext?.user?.fid?.toString()}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        <div className="lg:col-span-8 card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
          <div className="card-body p-4">
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

        <div className="lg:col-span-4 space-y-4">
          <TokenInfo token={token} />
          <TokenActions token={token} onStakingChange={handleStakingChange} />
          <StakedBalance
            data-staking-balance
            stakingAddress={token.staking_address}
            stakingPool={token.staking_pool}
            symbol={token.symbol}
            tokenAddress={token.contract_address}
          />
          {isConnected && (
            <ClaimFeesButton
              tokenAddress={token.contract_address}
              creatorAddress={isCreator ? address : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
