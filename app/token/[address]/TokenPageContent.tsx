"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TokenActions } from "./TokenActions";
import { Token } from "@/app/types/token";
import { TokenInfo } from "./TokenInfo";
import { StakedBalance } from "@/app/components/StakedBalance";
import { ClaimFeesButton } from "@/app/components/ClaimFeesButton";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { LP_FACTORY_ADDRESS, LP_FACTORY_ABI } from "@/app/lib/contracts";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

type LinkedAccount = {
  type: string;
  address?: string;
};

type PrivyUser = {
  linkedAccounts?: LinkedAccount[];
};

const getAllUserAddresses = (user: PrivyUser) => {
  if (!user?.linkedAccounts) return [];
  return user.linkedAccounts
    .filter((account) => account.type === "wallet" && account.address)
    .map((account) => account.address!.toLowerCase());
};

type Deployment = {
  token: string;
  locker: string;
  positionId: bigint;
};

// const HARDCODED_ADDRESS = "0x1234567890123456789012345678901234567890";
// const BASED_FWOG_POOL = "0x1035ae3f87a91084c6c5084d0615cc6121c5e228";

// Mock data for the hardcoded address
// const mockToken: Token = {
//   id: 999999,
//   created_at: new Date().toISOString(),
//   tx_hash: "0x0",
//   contract_address: HARDCODED_ADDRESS,
//   requestor_fid: 1,
//   name: "Based Fwog",
//   symbol: "FWOG",
//   img_url: "/tokens/skimochi.avif",
//   pool_address: BASED_FWOG_POOL,
//   cast_hash: "0x0",
//   type: "token",
//   pair: "WETH",
//   chain_id: 8453,
//   metadata: {},
//   price: 0.0001,
//   marketCap: 459510,
//   marketCapChange: 12.77,
//   volume24h: 12420,
//   stakingAPY: 156.8,
//   change1h: 2.5,
//   change24h: 15.0,
//   change7d: 45.2,
//   rewardDistributed: 123456.78,
//   rewardRate: 1.85,
//   profileImage: null,
//   creator: {
//     name: "zeni",
//     score: 79,
//     recasts: 17,
//     likes: 62,
//     profileImage: "/avatars/zeni.avif",
//   },
//   pool_id: "0xa040a8564c433970d7919c441104b1d25b9eaa1c",
//   staking_pool: BASED_FWOG_POOL,
//   staking_address: BASED_FWOG_POOL,
// };

export function TokenPageContent() {
  const params = useParams();
  const address = params.address as string;
  const { user, ready } = usePrivy();
  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const isWalletConnected = ready && !!user?.wallet?.address;

  useEffect(() => {
    async function fetchToken() {
      try {
        const response = await fetch(`/api/tokens/single?address=${address}`);
        const data = await response.json();
        if (data.data) {
          setToken(data.data);
        }
      } catch (error) {
        console.error("Error fetching token:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchToken();
  }, [address]);

  // Add creator check effect
  useEffect(() => {
    if (!user || !token) return;

    const checkIsCreator = async () => {
      const userAddresses = getAllUserAddresses(user);
      try {
        for (const address of userAddresses) {
          const deployments = (await publicClient.readContract({
            address: LP_FACTORY_ADDRESS,
            abi: LP_FACTORY_ABI,
            functionName: "getTokensDeployedByUser",
            args: [address as `0x${string}`],
          })) as Deployment[];

          const isCreatorResult = deployments.some(
            (d) =>
              d.token.toLowerCase() === token.contract_address.toLowerCase()
          );

          if (isCreatorResult) {
            setIsCreator(true);
            return;
          }
        }
        setIsCreator(false);
      } catch (error) {
        console.error("Error checking creator status:", error);
        setIsCreator(false);
      }
    };

    checkIsCreator();
  }, [user, token]);

  const handleStakingChange = () => {
    // Force refresh of staked balance
    const stakedBalanceElement = document.querySelector(
      "[data-staking-balance]"
    );
    if (stakedBalanceElement) {
      stakedBalanceElement.dispatchEvent(new Event("refresh"));
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="loading loading-bars loading-lg text-primary"></div>
        </div>
      </div>
    );
  }

  if (!token) {
    return <div>Token not found</div>;
  }

  // Use Based Fwog's pool for the hardcoded address
  const embedUrl =
    address.toLowerCase() ===
    "0x1234567890123456789012345678901234567890".toLowerCase()
      ? "https://www.geckoterminal.com/base/pools/0x1035ae3f87a91084c6c5084d0615cc6121c5e228?embed=1&info=0&swaps=1&grayscale=0&light_chart=1"
      : `https://www.geckoterminal.com/base/pools/${token.pool_address}?embed=1&info=0&swaps=1&grayscale=0&light_chart=1`;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        {/* Chart */}
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

        {/* Right Column */}
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
          {isWalletConnected && (
            <ClaimFeesButton
              tokenAddress={token.contract_address}
              creatorAddress={isCreator ? user?.wallet?.address : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
