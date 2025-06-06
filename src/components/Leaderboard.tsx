"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Token } from "../app/types/token";
import { calculateRewards } from "@/src/lib/rewards";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useSupEligibility } from "@/src/hooks/useSupEligibility";

interface LeaderboardProps {
  tokens: Token[];
}

interface TokenWithStats extends Token {
  totalStakers: number;
  totalRewards: number;
}

export function Leaderboard({ tokens }: LeaderboardProps) {
  const [tokenData, setTokenData] = useState<TokenWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user's address from frame logic
  const { address, isMiniAppView } = useAppFrameLogic();

  // SUP eligibility hook
  const {
    eligibilityData,
    isLoading: isEligibilityLoading,
    fetchEligibility,
    getFormattedFlowRate,
  } = useSupEligibility();

  useEffect(() => {
    const fetchData = async () => {
      const enrichedTokens = await Promise.all(
        tokens.map(async (token) => {
          const { totalStreamed, totalStakers } = await calculateRewards(
            token.created_at,
            token.contract_address,
            token.staking_pool
          );
          return {
            ...token,
            totalStakers,
            totalRewards: totalStreamed,
          };
        })
      );

      // Sort by staker count and take top 25
      const sortedTokens = enrichedTokens
        .sort((a, b) => b.totalStakers - a.totalStakers)
        .slice(0, 25);

      setTokenData(sortedTokens);
      setLoading(false);
    };

    fetchData();
  }, [tokens]);

  // Fetch SUP eligibility when address is available and in mini app
  useEffect(() => {
    if (address && isMiniAppView && !eligibilityData && !isEligibilityLoading) {
      fetchEligibility(address).catch(console.error);
    }
  }, [
    address,
    isMiniAppView,
    eligibilityData,
    isEligibilityLoading,
    fetchEligibility,
  ]);

  const handleClaimSup = async () => {
    if (!eligibilityData?.claimNeeded) return;

    // TODO: Implement SUP claim functionality
    // This would typically open a transaction or redirect to claim interface
    console.log("Claiming SUP rewards...", eligibilityData);
    alert("SUP claim functionality will be implemented here!");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="loading loading-bars loading-lg text-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User's SUP Status - Only show in mini app */}
      {isMiniAppView && address && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🔥</span>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">
                  Your SUP Rewards
                </h3>
                <p className="text-sm text-blue-700">
                  {isEligibilityLoading ? (
                    <span className="loading loading-dots loading-sm"></span>
                  ) : eligibilityData ? (
                    <>
                      Flow Rate:{" "}
                      <span className="font-mono font-medium">
                        {getFormattedFlowRate()}
                      </span>
                      {eligibilityData.hasAllocations && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          Eligible
                        </span>
                      )}
                    </>
                  ) : (
                    "Loading eligibility..."
                  )}
                </p>
              </div>
            </div>

            {eligibilityData?.claimNeeded && (
              <button
                onClick={handleClaimSup}
                className="btn btn-primary btn-sm"
              >
                Claim SUP
              </button>
            )}
          </div>

          {eligibilityData && eligibilityData.eligibility.length > 0 && (
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-xs text-blue-600 mb-2">Eligible Programs:</p>
              <div className="flex flex-wrap gap-2">
                {eligibilityData.eligibility
                  .filter((item) => item.eligible)
                  .map((item) => (
                    <span
                      key={item.pointSystemId}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                    >
                      {item.pointSystemName}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="overflow-x-auto rounded-lg border border-base-200">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="bg-base-200/50">
              <th className="w-16">#</th>
              <th>Token</th>
              <th className="w-32 text-right">Stakers</th>
            </tr>
          </thead>
          <tbody>
            {tokenData.map((token, index) => (
              <tr
                key={token.contract_address}
                className={`hover:bg-base-200/50 transition-colors duration-200 ${
                  index === 0
                    ? "bg-gradient-to-r from-amber-50/50 to-transparent"
                    : index === 1
                    ? "bg-gradient-to-r from-slate-50/50 to-transparent"
                    : index === 2
                    ? "bg-gradient-to-r from-orange-50/50 to-transparent"
                    : ""
                }`}
              >
                <td
                  className={`font-mono pl-6 ${
                    index === 0
                      ? "text-2xl font-bold text-amber-500"
                      : index === 1
                      ? "text-xl font-bold text-slate-500"
                      : index === 2
                      ? "text-lg font-bold text-orange-600"
                      : "text-base-content/60"
                  }`}
                >
                  {index === 0
                    ? "🏆"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : index + 1}
                </td>
                <td>
                  <Link
                    href={`/token/${token.contract_address}`}
                    className={`flex items-center gap-3 transition-colors duration-200 ${
                      index < 3 ? "hover:text-primary/80" : "hover:text-primary"
                    }`}
                  >
                    {token.img_url ? (
                      <div
                        className={`w-10 h-10 relative overflow-hidden rounded-lg ${
                          index === 0
                            ? "ring-2 ring-amber-400 ring-offset-2"
                            : index === 1
                            ? "ring-2 ring-slate-400 ring-offset-2"
                            : index === 2
                            ? "ring-2 ring-orange-400 ring-offset-2"
                            : ""
                        }`}
                      >
                        <Image
                          src={token.img_url}
                          alt={token.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized={
                            token.img_url.includes(".gif") ||
                            token.img_url.includes("imagedelivery.net")
                          }
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 bg-primary/10 flex items-center justify-center rounded-lg text-primary font-mono text-sm ${
                          index === 0
                            ? "ring-2 ring-amber-400 ring-offset-2"
                            : index === 1
                            ? "ring-2 ring-slate-400 ring-offset-2"
                            : index === 2
                            ? "ring-2 ring-orange-400 ring-offset-2"
                            : ""
                        }`}
                      >
                        {token.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div
                        className={`font-medium truncate ${
                          index === 0
                            ? "text-lg text-amber-700"
                            : index === 1
                            ? "text-lg text-slate-700"
                            : index === 2
                            ? "text-lg text-orange-700"
                            : ""
                        }`}
                      >
                        {token.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-base-content/60">
                        <span>by</span>
                        <div className="avatar">
                          <div className="w-4 h-4 rounded-full">
                            <Image
                              src={
                                token.creator?.profileImage ??
                                `/avatars/${
                                  token.creator?.name ?? "streme"
                                }.png`
                              }
                              alt={token.creator?.name ?? "Anon"}
                              width={16}
                              height={16}
                              unoptimized={
                                (token.creator?.profileImage?.includes(
                                  ".gif"
                                ) ||
                                  token.creator?.profileImage?.includes(
                                    "imagedelivery.net"
                                  )) ??
                                false
                              }
                            />
                          </div>
                        </div>
                        <span className="truncate">
                          {token.creator?.name ?? "Anon"}
                        </span>
                      </div>
                    </div>
                  </Link>
                </td>
                <td
                  className={`text-right font-mono pr-6 ${
                    index === 0
                      ? "text-lg font-bold text-amber-600"
                      : index === 1
                      ? "text-lg font-bold text-slate-600"
                      : index === 2
                      ? "text-lg font-bold text-orange-700"
                      : "text-base-content/80"
                  }`}
                >
                  {token.totalStakers.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
