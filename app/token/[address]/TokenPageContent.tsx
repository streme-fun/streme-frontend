"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import FarcasterIcon from "@/public/farcaster.svg";
import { TokenActions } from "./TokenActions";
import { Token } from "@/app/types/token";

const HARDCODED_ADDRESS = "0x1234567890123456789012345678901234567890";
const BASED_FWOG_POOL = "0x1035ae3f87a91084c6c5084d0615cc6121c5e228";

// Mock data for the hardcoded address
const mockToken: Token = {
  id: 999999,
  created_at: new Date().toISOString(),
  tx_hash: "0x0",
  contract_address: HARDCODED_ADDRESS,
  requestor_fid: 1,
  name: "Based Fwog",
  symbol: "FWOG",
  img_url: "/tokens/skimochi.avif",
  pool_address: BASED_FWOG_POOL,
  cast_hash: "0x0",
  type: "token",
  pair: "WETH",
  chain_id: 8453,
  metadata: {},
  price: 0.0001,
  marketCap: 459510,
  marketCapChange: 12.77,
  volume24h: 12420,
  stakingAPY: 156.8,
  change1h: 2.5,
  change24h: 15.0,
  change7d: 45.2,
  rewardDistributed: 123456.78,
  rewardRate: 1.85,
  profileImage: null,
  creator: {
    name: "zeni",
    score: 79,
    recasts: 17,
    likes: 62,
    profileImage: "/avatars/zeni.avif",
  },
  pool_id: "0xa040a8564c433970d7919c441104b1d25b9eaa1c",
  staking_pool: "0xa040a8564c433970d7919c441104b1d25b9eaa1c",
};

export function TokenPageContent() {
  const params = useParams();
  const address = params.address as string;

  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchToken() {
      try {
        // Return mock data for hardcoded address
        if (address.toLowerCase() === HARDCODED_ADDRESS.toLowerCase()) {
          setToken(mockToken);
          return;
        }

        const response = await fetch("/api/tokens");
        const data = await response.json();
        const matchedToken = data.data.find(
          (t: Token) =>
            t.contract_address.toLowerCase() === address.toLowerCase()
        );
        setToken(matchedToken || null);
      } catch (error) {
        console.error("Error fetching token:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchToken();
  }, [address]);

  if (loading) {
    return <div>Loading...</div>;
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

  const shortenHash = (hash: string | undefined) => {
    if (!hash) return "";
    return hash.slice(0, 10);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        {/* Chart */}
        <div className="lg:col-span-8 card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{token.name}</h2>
              {token.cast_hash && token.creator?.name && (
                <a
                  href={`https://warpcast.com/${
                    token.creator.name
                  }/${shortenHash(token.cast_hash)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary inline-flex items-center gap-2"
                  title={shortenHash(token.cast_hash)}
                >
                  <Image
                    src={FarcasterIcon}
                    alt={`View on Farcaster: ${shortenHash(token.cast_hash)}`}
                    width={16}
                    height={16}
                    className="opacity-80 hover:opacity-100"
                  />
                  <span className="text-sm opacity-60">View on Farcaster</span>
                </a>
              )}
            </div>
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

        {/* Trading Interface */}
        <div className="lg:col-span-4">
          <TokenActions token={token} />
        </div>
      </div>
    </div>
  );
}
