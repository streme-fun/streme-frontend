"use client";

import { CROWDFUND_TOKENS } from "@/src/lib/crowdfundTokens";
import { Token } from "@/src/app/types/token";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function CrowdfundListPage() {
  const [tokenData, setTokenData] = useState<Record<string, Token>>({});

  useEffect(() => {
    // Fetch token data for each crowdfund token
    const fetchTokenData = async () => {
      const data: Record<string, Token> = {};
      for (const token of CROWDFUND_TOKENS) {
        try {
          const response = await fetch(`/api/token/${token.address}`);
          if (response.ok) {
            const tokenInfo = await response.json();
            data[token.address] = tokenInfo;
          }
        } catch (error) {
          console.error(`Error fetching data for ${token.symbol}:`, error);
        }
      }
      setTokenData(data);
    };

    fetchTokenData();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Active Crowdfunds</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CROWDFUND_TOKENS.map((token) => {
          const data = tokenData[token.address];

          return (
            <Link
              key={token.address}
              href={`/crowdfund/${token.slug}`}
              className="block"
            >
              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <figure className="relative h-48 bg-gradient-to-br from-primary/10 to-secondary/10">
                  {data?.img_url ? (
                    <Image
                      src={data.img_url}
                      alt={token.name}
                      fill
                      className="object-cover"
                      unoptimized={
                        data.img_url.includes(".gif") ||
                        data.img_url.includes("imagedelivery.net")
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary">
                      ${token.symbol}
                    </div>
                  )}
                </figure>
                <div className="card-body">
                  <h2 className="card-title">
                    {token.fundTitle || `${token.name} Crowdfund`}
                    <div className="badge badge-secondary">${token.symbol}</div>
                  </h2>
                  <p className="opacity-80">
                    {token.description || "Support the growth of this project"}
                  </p>

                  <div className="card-actions justify-end mt-4">
                    <button className="btn btn-primary">View Campaign →</button>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {CROWDFUND_TOKENS.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg opacity-60">
            No active crowdfunds at the moment
          </p>
        </div>
      )}
    </div>
  );
}
