"use client";

import { useState, useEffect, useCallback } from "react";
import BackButton from "@/src/components/BackButton";
import Image from "next/image";
import { LaunchedToken } from "@/src/app/types";
import { ClaimFeesButton } from "@/src/components/ClaimFeesButton";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useWallet } from "@/src/hooks/useWallet";
import { Modal } from "@/src/components/Modal";
import { LaunchTokenModal } from "@/src/components/LaunchTokenModal";
import { HeroAnimationMini } from "@/src/components/HeroAnimationMini";
import { SPAMMER_BLACKLIST } from "@/src/lib/blacklist";
import sdk from "@farcaster/miniapp-sdk";
import { UpdateVaultBeneficiaryModal } from "@/src/components/UpdateVaultBeneficiaryModal";
import { ClaimVaultButton } from "@/src/components/ClaimVaultButton";

interface TokenStaker {
  account: {
    id: string;
  };
  units: string;
  isConnected: boolean;
  createdAtTimestamp: string;
  farcasterUser?: FarcasterUser;
}

interface FarcasterUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

interface RawStakerData {
  // Legacy field names (for backward compatibility)
  account?: string;
  address?: string;
  units?: string;
  balance?: string;
  farcasterUser?: FarcasterUser;

  // Current API field names
  holder_address?: string;
  staked_balance?: number;
  farcaster?: {
    fid: number;
    username: string;
    pfp_url: string;
  };

  // Common fields
  isConnected?: boolean;
  createdAtTimestamp?: string;
  timestamp?: string;
  fid?: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  profileImage?: string;
}

interface BackendVault {
  vault: string;
  token: string;
  admin: string;
  supply: number;
  lockupDuration: number;
  vestingDuration: number;
  pool: string;
  box: string;
  lockupEndTime?: number;
  vestingEndTime?: number;
}

interface EnrichedLaunchedToken extends LaunchedToken {
  totalStakers?: number;
  totalStaked?: number;
  stakers?: TokenStaker[];
  claimableFees?: {
    amount0: number;
    amount1: number;
    token0: string;
    token1: string;
  };
}

export default function LaunchedTokensPage() {
  const [tokens, setTokens] = useState<EnrichedLaunchedToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet connection hooks
  const {
    isConnected: isWalletConnected,
    address: deployerAddress,
    isMiniApp,
  } = useWallet();
  const { isMiniAppView, isSDKLoaded } = useAppFrameLogic();

  // Debug logging for address changes
  useEffect(() => {
    console.log("📍 Address change debug:", {
      isMiniAppView,
      deployerAddress,
      isWalletConnected,
      isMiniApp,
      timestamp: new Date().toISOString(),
    });
  }, [isMiniAppView, deployerAddress, isWalletConnected, isMiniApp]);
  const [selectedTokenStakers, setSelectedTokenStakers] = useState<{
    token: EnrichedLaunchedToken;
    isOpen: boolean;
  } | null>(null);
  const [stakersWithFarcaster, setStakersWithFarcaster] = useState<
    TokenStaker[] | null
  >(null);
  const [stakersSortBy, setStakersSortBy] = useState<
    "units" | "address" | "status" | "joined"
  >("units");
  const [stakersSortDirection, setStakersSortDirection] = useState<
    "asc" | "desc"
  >("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "stakers" | "holders">(
    "all"
  );
  const [filterFarcaster, setFilterFarcaster] = useState<
    "all" | "with" | "without"
  >("all");
  const [filterConnection, setFilterConnection] = useState<
    "all" | "connected" | "not_connected"
  >("all");
  const [isLaunchTokenOpen, setIsLaunchTokenOpen] = useState(false);
  const [vaultModalState, setVaultModalState] = useState<{
    isOpen: boolean;
    token?: EnrichedLaunchedToken;
  }>({ isOpen: false });

  const enrichTokensWithStakingData = useCallback(
    async (tokenList: LaunchedToken[]): Promise<EnrichedLaunchedToken[]> => {
      const enrichmentPromises = tokenList.map(async (token) => {
        try {
          // Process vault data from backend's vaults array
          const backendVaults = (
            token as LaunchedToken & { vaults?: BackendVault[] }
          ).vaults;
          const vault =
            backendVaults && backendVaults.length > 0
              ? {
                  allocation: 0, // Will be calculated below
                  beneficiary: backendVaults[0].admin,
                  admin: backendVaults[0].admin,
                  lockDuration: backendVaults[0].lockupDuration,
                  vestingDuration: backendVaults[0].vestingDuration,
                  supply: backendVaults[0].supply,
                  pool: backendVaults[0].pool,
                  box: backendVaults[0].box,
                  lockupEndTime: backendVaults[0].lockupEndTime,
                  vestingEndTime: backendVaults[0].vestingEndTime,
                }
              : undefined;

          // Calculate allocations if we have staking data or vault
          let allocations = undefined;
          if (token.staking || vault) {
            const totalSupply = 100000000000; // 100B tokens (constant)
            const stakingAllocation = token.staking
              ? Math.round((token.staking.supply / totalSupply) * 100)
              : 0;
            const vaultAllocation = vault
              ? Math.round((vault.supply / totalSupply) * 100)
              : 0;
            const liquidityAllocation =
              100 - stakingAllocation - vaultAllocation;

            allocations = {
              staking: stakingAllocation,
              vault: vaultAllocation,
              liquidity: liquidityAllocation,
            };

            // Update vault allocation percentage
            if (vault) {
              vault.allocation = vaultAllocation;
            }
          }

          // Fetch pool summary data (totalMembers) and stakers list in parallel
          const [poolSummary, stakers] = await Promise.all([
            fetchPoolSummary(token.staking_pool),
            fetchTokenStakers(token.staking_pool),
          ]);

          const totalStaked = stakers.reduce(
            (sum, staker) => sum + parseInt(staker.units),
            0
          );

          let claimableFees = undefined;
          try {
            const res = await fetch(
              `/api/token/${token.contract_address}/claimable-fees`
            );
            if (res.ok) {
              const data = await res.json();
              claimableFees = {
                amount0: data.amount0,
                amount1: data.amount1,
                token0: data.token0,
                token1: data.token1,
              };
              console.log(
                `Claimable fees for ${token.contract_address}:`,
                claimableFees
              );
            } else {
              console.warn(
                `Claimable fees API returned ${res.status} for token ${token.contract_address}`
              );
            }
          } catch (error) {
            console.warn(
              `Failed to fetch claimable fees for token ${token.contract_address}:`,
              error
            );
          }

          return {
            ...token,
            vault,
            allocations,
            totalStakers: poolSummary.totalMembers, // Use totalMembers from pool data
            totalStaked,
            stakers,
            claimableFees,
          };
        } catch (err) {
          console.warn(
            `Failed to enrich token ${token.contract_address}:`,
            err
          );
          return {
            ...token,
            vault: undefined,
            allocations: undefined,
            totalStakers: 0,
            totalStaked: 0,
            stakers: [],
          };
        }
      });

      return Promise.all(enrichmentPromises);
    },
    []
  );

  const fetchLaunchedTokens = useCallback(async () => {
    if (!deployerAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tokens/deployer/${deployerAddress}?type=all`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch tokens");
      }

      // Filter out blacklisted tokens and tokens with $ in name/symbol
      const filteredTokens = result.data.filter((token: LaunchedToken) => {
        if (token.username) {
          const username = token.username.toLowerCase();
          const isBlacklisted = SPAMMER_BLACKLIST.includes(username);
          if (isBlacklisted) return false;
        }

        // Filter out tokens with $ in name or symbol
        if (token.name && token.name.includes("$")) {
          return false;
        }
        if (token.symbol && token.symbol.includes("$")) {
          return false;
        }

        return true;
      });

      const enrichedTokens = await enrichTokensWithStakingData(filteredTokens);
      setTokens(enrichedTokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [deployerAddress, enrichTokensWithStakingData]);

  // Automatically fetch tokens when deployerAddress is available
  useEffect(() => {
    if (deployerAddress) {
      fetchLaunchedTokens();
    }
  }, [deployerAddress, fetchLaunchedTokens]);

  // Fetch pool summary data including totalMembers count
  const fetchPoolSummary = async (stakingPoolId: string) => {
    try {
      // Use the internal API route to get stakers and derive the pool summary
      const response = await fetch(`/api/token/${stakingPoolId}/stakers`);

      if (!response.ok) {
        console.warn(`Failed to fetch pool summary: ${response.status}`);
        return {
          totalMembers: 0,
          totalUnits: "0",
        };
      }

      const data = await response.json();

      // Calculate total members and total units from stakers data
      const totalMembers = data.length;
      const totalUnits = data.reduce((sum: bigint, staker: RawStakerData) => {
        // Handle both new API format (staked_balance as number) and legacy format (units/balance as string)
        const units = staker.staked_balance
          ? BigInt(Math.floor(staker.staked_balance))
          : BigInt(staker.units || staker.balance || "0");
        return sum + units;
      }, BigInt(0));

      return {
        totalMembers,
        totalUnits: totalUnits.toString(),
      };
    } catch (err) {
      console.error("Failed to fetch pool summary:", err);
      return {
        totalMembers: 0,
        totalUnits: "0",
      };
    }
  };

  const fetchTokenStakers = async (
    stakingPoolId: string
  ): Promise<TokenStaker[]> => {
    try {
      // Use the internal API route
      const response = await fetch(`/api/token/${stakingPoolId}/stakers`);

      if (!response.ok) {
        console.warn(`Failed to fetch stakers: ${response.status}`);
        return [];
      }

      const data = await response.json();

      // Transform the data to match our TokenStaker interface
      const transformedStakers: TokenStaker[] = data.map(
        (staker: RawStakerData) => ({
          account: {
            id: staker.holder_address || staker.account || staker.address || "",
          },
          units: staker.staked_balance
            ? Math.floor(staker.staked_balance).toString()
            : staker.units || staker.balance || "0",
          isConnected: staker.isConnected ?? true,
          createdAtTimestamp:
            staker.createdAtTimestamp || staker.timestamp || "0",
          farcasterUser: staker.farcaster
            ? {
                fid: staker.farcaster.fid,
                username: staker.farcaster.username,
                display_name: staker.farcaster.username, // Use username as display_name if not provided
                pfp_url: staker.farcaster.pfp_url,
              }
            : staker.farcasterUser ||
              (staker.username
                ? {
                    fid: staker.fid || 0,
                    username: staker.username,
                    display_name: staker.display_name || staker.username,
                    pfp_url: staker.pfp_url || staker.profileImage || "",
                  }
                : undefined),
        })
      );

      console.log(
        `Fetched ${transformedStakers.length} stakers for token ${stakingPoolId}`
      );

      return transformedStakers;
    } catch (err) {
      console.error("Failed to fetch stakers:", err);
      return [];
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (!price || isNaN(price)) return "-";

    if (price < 0.01 && price > 0) {
      const decimalStr = price.toFixed(20).split(".")[1];
      let zeroCount = 0;
      while (decimalStr[zeroCount] === "0") {
        zeroCount++;
      }

      return (
        <span className="whitespace-nowrap">
          $0.0{zeroCount > 0 && <sub>{zeroCount}</sub>}
          {decimalStr.slice(zeroCount, zeroCount + 4)}
        </span>
      );
    }

    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    })}`;
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`;
    } else if (marketCap >= 1000) {
      return `$${(marketCap / 1000).toFixed(2)}K`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    const color = value >= 0 ? "text-green-500" : "text-red-500";
    const sign = value >= 0 ? "+" : "";
    return (
      <span className={color}>
        {sign}
        {value.toFixed(2)}%
      </span>
    );
  };

  const formatDate = (timestamp: { _seconds: number }) => {
    return new Date(timestamp._seconds * 1000).toLocaleDateString();
  };

  const handleStakersSort = (
    column: "units" | "address" | "status" | "joined"
  ) => {
    if (stakersSortBy === column) {
      // Toggle direction if same column
      setStakersSortDirection(stakersSortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, set default direction
      setStakersSortBy(column);
      setStakersSortDirection(column === "units" ? "desc" : "asc"); // Units default to desc (largest first)
    }
  };

  const getFilteredAndSortedStakers = (stakers: TokenStaker[]) => {
    return [...stakers]
      .filter((staker) => staker && staker.account?.id) // Filter out invalid stakers
      .filter((staker) => {
        // Search filter
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const addressMatch = staker.account.id
            ?.toLowerCase()
            .includes(searchLower);
          const usernameMatch = staker.farcasterUser?.username
            ?.toLowerCase()
            .includes(searchLower);
          if (!addressMatch && !usernameMatch) return false;
        }

        // Type filter - all are stakers in this context
        if (filterType === "holders") return false; // No pure holders in stakers list

        // Farcaster filter
        if (filterFarcaster === "with" && !staker.farcasterUser) return false;
        if (filterFarcaster === "without" && staker.farcasterUser) return false;

        // Connection status filter
        if (filterConnection === "connected" && !staker.isConnected)
          return false;
        if (filterConnection === "not_connected" && staker.isConnected)
          return false;

        return true;
      })
      .sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (stakersSortBy) {
          case "units":
            aValue = parseInt(a.units) || 0;
            bValue = parseInt(b.units) || 0;
            break;
          case "address":
            aValue = (a.account.id || "").toLowerCase();
            bValue = (b.account.id || "").toLowerCase();
            break;
          case "status":
            aValue = a.isConnected ? 1 : 0;
            bValue = b.isConnected ? 1 : 0;
            break;
          case "joined":
            aValue = parseInt(a.createdAtTimestamp) || 0;
            bValue = parseInt(b.createdAtTimestamp) || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return stakersSortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return stakersSortDirection === "asc" ? 1 : -1;
        return 0;
      });
  };

  // Helper to format fee values safely
  const formatFeeValue = (value: unknown, symbol?: string) => {
    const num = typeof value === "number" ? value : Number(value);
    if (value === null || value === undefined || isNaN(num)) return "-";
    return `${num.toFixed(6)}${symbol ? " " + symbol.slice(0, 6) : ""}`;
  };

  // Mini-app view
  if (isMiniAppView) {
    return (
      <div className="font-[family-name:var(--font-geist-sans)] min-h-screen relative">
        {/* Background Animation */}
        <div className="fixed inset-0 -z-10">
          <HeroAnimationMini />
        </div>

        <BackButton isMiniAppView={true} className="pt-4 relative z-10 mb-4" />

        {/* Fixed header */}
        <h1 className="text-lg font-bold px-4 relative z-10">
          Launched Tokens
        </h1>
        <div className="px-4 relative z-10">
          <p className="text-sm opacity-70">
            {deployerAddress ? (
              <>
                Wallet address: {deployerAddress.slice(0, 6).toLowerCase()}...
                {deployerAddress.slice(-4).toLowerCase()}
              </>
            ) : (
              "Connect wallet to view your launched tokens"
            )}
          </p>
        </div>

        {/* Main content */}
        <div className="p-4 relative z-10">
          {!deployerAddress && !loading && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body text-center">
                <h3 className="text-xl font-bold mb-4">Connect Your Wallet</h3>
                <p className="opacity-70 mb-4">
                  Please connect your wallet to view your launched tokens
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex flex-col justify-center items-center py-8 gap-3">
              <span className="loading loading-spinner loading-lg"></span>
              <p className="text-sm opacity-70">
                Loading your launched tokens...
              </p>
            </div>
          )}

          {tokens.length > 0 && (
            <div className="space-y-4 pb-16">
              {tokens.map((token) => (
                <div
                  key={token.contract_address}
                  className="card bg-base-100 border border-gray-300"
                >
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {token.img_url && (
                        <div className="avatar">
                          <div className="mask mask-squircle w-12 h-12">
                            <Image
                              src={token.img_url}
                              alt={token.name}
                              width={48}
                              height={48}
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                      <a
                        href={`/token/${token.contract_address}`}
                        className="flex-1"
                      >
                        <h3 className="font-bold text-lg">{token.name}</h3>
                        <p className="text-sm opacity-70">${token.symbol}</p>
                      </a>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="opacity-70">Price</p>
                        <p className="font-mono font-semibold">
                          {token.marketData?.price
                            ? formatPrice(token.marketData.price)
                            : "--"}
                        </p>
                      </div>
                      <div>
                        <p className="opacity-70">Market Cap</p>
                        <p className="font-mono font-semibold">
                          {token.marketData?.marketCap
                            ? formatMarketCap(token.marketData.marketCap)
                            : "--"}
                        </p>
                      </div>
                      <div>
                        <p className="opacity-70">Stakers</p>
                        <p className="font-mono font-semibold">
                          {token.totalStakers ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="opacity-70">Created</p>
                        <p className="text-sm">{formatDate(token.timestamp)}</p>
                      </div>
                    </div>

                    {/* Claimable Fees Section */}
                    {token.claimableFees &&
                      (Number(token.claimableFees.amount0) > 0 ||
                        Number(token.claimableFees.amount1) > 0) && (
                        <div className="mt-3 p-2 bg-base-200 rounded-lg">
                          <p className="text-xs opacity-70 mb-1">
                            Claimable Fees
                          </p>
                          <div className="flex flex-col gap-1">
                            {Number(token.claimableFees.amount0) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs opacity-70">
                                  {token.symbol}:
                                </span>
                                <span className="text-xs font-mono font-semibold">
                                  {formatFeeValue(token.claimableFees.amount0)}
                                </span>
                              </div>
                            )}
                            {Number(token.claimableFees.amount1) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs opacity-70">
                                  WETH:
                                </span>
                                <span className="text-xs font-mono font-semibold">
                                  {formatFeeValue(token.claimableFees.amount1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isWalletConnected ? (
                        <ClaimFeesButton
                          tokenAddress={token.contract_address}
                          creatorAddress={token.deployer}
                          className="btn btn-sm btn-outline btn-secondary "
                        />
                      ) : (
                        <button
                          className="btn btn-sm btn-outline btn-disabled "
                          disabled
                        >
                          Connect Wallet
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setSelectedTokenStakers({
                            token,
                            isOpen: true,
                          });
                          // Stakers already have Farcaster data from the API
                          setStakersWithFarcaster(token.stakers || []);
                        }}
                        disabled={!token.stakers || token.stakers.length === 0}
                      >
                        View Stakers
                      </button>
                      {token.vault?.admin && isWalletConnected && (
                        <ClaimVaultButton
                          tokenAddress={token.contract_address}
                          adminAddress={token.vault.admin}
                          className="btn btn-sm btn-outline btn-success"
                        />
                      )}
                      {token.vault && isWalletConnected && (
                        <button
                          className="btn btn-sm btn-outline btn-primary"
                          onClick={() =>
                            setVaultModalState({ isOpen: true, token })
                          }
                        >
                          Manage Vault
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tokens.length === 0 && !loading && !error && deployerAddress && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body text-center">
                <div className="mb-4">
                  <p className="opacity-60 mb-4">
                    No tokens have been launched from this wallet yet
                  </p>
                  <button
                    onClick={async () => {
                      if (isSDKLoaded && sdk) {
                        try {
                          const castText = `@streme Launch a token for me

Name: [your token name]
Symbol: $[your ticker]

[Don't forget to attach an image!] 🎨`;
                          await sdk.actions.composeCast({
                            text: castText,
                            embeds: [],
                          });
                        } catch (error) {
                          console.error("Error composing cast:", error);
                          setIsLaunchTokenOpen(true);
                        }
                      } else {
                        console.warn(
                          "Farcaster SDK not loaded or sdk not available. Opening LaunchTokenModal as fallback."
                        );
                        setIsLaunchTokenOpen(true);
                      }
                    }}
                    className="btn btn-primary"
                  >
                    Launch Your First Token
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vault Management Modal for mini-app */}
        {vaultModalState.isOpen && vaultModalState.token && (
          <UpdateVaultBeneficiaryModal
            isOpen={vaultModalState.isOpen}
            onClose={() => setVaultModalState({ isOpen: false })}
            tokenAddress={vaultModalState.token.contract_address}
            adminAddress={deployerAddress || ""}
            tokenSymbol={vaultModalState.token.symbol}
          />
        )}

        {/* Stakers Modal for mini-app */}
        {selectedTokenStakers && (
          <Modal
            isOpen={selectedTokenStakers.isOpen}
            onClose={() => {
              setSelectedTokenStakers(null);
              setStakersWithFarcaster(null);
            }}
          >
            <div className="p-6">
              <h3 className="font-bold text-lg mb-4">
                {selectedTokenStakers.token.name} Stakers
              </h3>

              <div className="mb-4 text-sm opacity-70">
                {selectedTokenStakers.token.totalStakers || 0} total stakers
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr>
                      <th
                        className="cursor-pointer"
                        onClick={() => handleStakersSort("address")}
                      >
                        Holder
                        {stakersSortBy === "address" && (
                          <span className="ml-1">
                            {stakersSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="cursor-pointer"
                        onClick={() => handleStakersSort("units")}
                      >
                        Staked
                        {stakersSortBy === "units" && (
                          <span className="ml-1">
                            {stakersSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="cursor-pointer"
                        onClick={() => handleStakersSort("status")}
                      >
                        Status
                        {stakersSortBy === "status" && (
                          <span className="ml-1">
                            {stakersSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stakersWithFarcaster
                      ? getFilteredAndSortedStakers(stakersWithFarcaster)
                      : selectedTokenStakers.token.stakers
                      ? getFilteredAndSortedStakers(
                          selectedTokenStakers.token.stakers
                        )
                      : []
                    ).map((staker, index) => (
                      <tr key={`${staker.account.id}-${index}`}>
                        <td>
                          <div className="flex items-center gap-2">
                            {staker.farcasterUser?.pfp_url && (
                              <Image
                                src={staker.farcasterUser.pfp_url}
                                alt=""
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full"
                                unoptimized
                              />
                            )}
                            <div>
                              <a
                                href={`https://basescan.org/address/${staker.account.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link link-primary font-mono text-xs"
                              >
                                {staker.account.id
                                  ? `${staker.account.id.slice(
                                      0,
                                      4
                                    )}...${staker.account.id.slice(-3)}`
                                  : "Unknown"}
                              </a>
                              {staker.farcasterUser?.username && (
                                <div className="text-xs opacity-70">
                                  @{staker.farcasterUser.username}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-xs">
                          {parseInt(staker.units).toLocaleString()}
                        </td>
                        <td>
                          <div
                            className={`badge badge-xs ${
                              staker.isConnected
                                ? "badge-success"
                                : "badge-warning"
                            }`}
                          >
                            {staker.isConnected ? "✓" : "○"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-action">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setSelectedTokenStakers(null);
                    setStakersWithFarcaster(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // Standard desktop/mobile view
  return (
    <>
      <div className="min-h-screen py-8 mt-20 relative">
        {/* Background Animation */}
        <div className="fixed inset-0 -z-10">
          <HeroAnimationMini />
        </div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">Launched Tokens</h1>
            <p className="mb-6 opacity-70">
              {deployerAddress ? (
                <>
                  Tokens launched by:{" "}
                  <span className="font-mono">
                    {deployerAddress.slice(0, 6).toLowerCase()}...
                    {deployerAddress.slice(-4).toLowerCase()}
                  </span>
                </>
              ) : (
                "Connect your wallet to view your launched tokens"
              )}
            </p>

            {!deployerAddress && !loading && (
              <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body text-center">
                  <h3 className="text-2xl font-bold mb-4">
                    Connect Your Wallet
                  </h3>
                  <p className="opacity-70 mb-4">
                    Please connect your wallet to view your launched tokens
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="alert alert-error mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {loading && (
              <div className="flex flex-col justify-center items-center py-12 gap-4">
                <span className="loading loading-spinner loading-lg"></span>
                <p className="text-sm opacity-70">
                  Loading your launched tokens...
                </p>
              </div>
            )}
          </div>

          {tokens.length > 0 && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4">
                  {tokens.length} Token{tokens.length !== 1 ? "s" : ""} Found
                </h2>

                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Price</th>
                        <th>Market Cap</th>
                        <th>24h Change</th>
                        <th>Volume 24h</th>
                        <th>Stakers</th>
                        <th>Claimable Fees</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((token) => (
                        <tr key={token.contract_address} className="hover">
                          <td>
                            <div className="flex items-center gap-3">
                              {token.img_url && (
                                <div className="avatar">
                                  <div className="mask mask-squircle w-12 h-12">
                                    <Image
                                      src={token.img_url}
                                      alt={token.name}
                                      width={48}
                                      height={48}
                                      unoptimized
                                    />
                                  </div>
                                </div>
                              )}
                              <div>
                                <a
                                  href={`/token/${token.contract_address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="link link-hover"
                                >
                                  <div className="font-bold">{token.name}</div>
                                  <div className="text-sm opacity-50">
                                    ${token.symbol}
                                  </div>
                                </a>
                              </div>
                            </div>
                          </td>
                          <td className="font-mono">
                            {token.marketData?.price
                              ? formatPrice(token.marketData.price)
                              : "--"}
                          </td>
                          <td className="font-mono">
                            {token.marketData?.marketCap
                              ? formatMarketCap(token.marketData.marketCap)
                              : "--"}
                          </td>
                          <td>
                            {token.marketData?.priceChange24h
                              ? formatPercentage(
                                  token.marketData.priceChange24h
                                )
                              : "--"}
                          </td>
                          <td className="font-mono">
                            {token.marketData?.volume24h
                              ? formatMarketCap(token.marketData.volume24h)
                              : "N/A"}
                          </td>
                          <td className="text-center">
                            <button
                              className="badge badge-outline hover:badge-primary cursor-pointer"
                              onClick={() => {
                                setSelectedTokenStakers({
                                  token,
                                  isOpen: true,
                                });
                                // Stakers already have Farcaster data from the API
                                setStakersWithFarcaster(token.stakers || []);
                              }}
                              disabled={
                                !token.stakers || token.stakers.length === 0
                              }
                            >
                              {token.totalStakers ?? 0}
                            </button>
                          </td>
                          <td className="font-mono">
                            {token.claimableFees ? (
                              <div className="flex flex-col gap-1">
                                <span>
                                  {formatFeeValue(token.claimableFees.amount0)}
                                  <span className="ml-1 text-xs opacity-70">
                                    {token.symbol}
                                  </span>
                                </span>
                                <span>
                                  {formatFeeValue(token.claimableFees.amount1)}
                                  <span className="ml-1 text-xs opacity-70">
                                    WETH
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <span title="No claimable fees data available">
                                -
                              </span>
                            )}
                          </td>

                          <td className="opacity-50">
                            {formatDate(token.timestamp)}
                          </td>
                          <td>
                            <div className="flex flex-col gap-2 w-32">
                              {isWalletConnected ? (
                                <ClaimFeesButton
                                  tokenAddress={token.contract_address}
                                  creatorAddress={token.deployer}
                                  className="btn btn-sm btn-outline btn-secondary w-full"
                                />
                              ) : (
                                <button
                                  className="btn btn-sm btn-outline btn-disabled w-full"
                                  disabled
                                  title="Connect wallet to claim fees"
                                >
                                  Connect Wallet
                                </button>
                              )}
                              {token.vault?.admin && isWalletConnected && (
                                <ClaimVaultButton
                                  tokenAddress={token.contract_address}
                                  adminAddress={token.vault.admin}
                                  className="btn btn-sm btn-outline btn-success w-full"
                                />
                              )}
                              {token.vault && isWalletConnected && (
                                <button
                                  className="btn btn-sm btn-outline btn-primary w-full"
                                  onClick={() =>
                                    setVaultModalState({ isOpen: true, token })
                                  }
                                >
                                  Manage Vault
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tokens.length === 0 && !loading && !error && deployerAddress && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body text-center">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold mb-2">
                    Ready to launch your first token?
                  </h3>
                  <p className="opacity-60 mb-6">
                    No tokens have been launched from this wallet yet. Get
                    started by launching your first token on Streme!
                  </p>
                  <button
                    onClick={() => setIsLaunchTokenOpen(true)}
                    className="btn btn-primary btn-lg"
                  >
                    Launch Your First Token
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stakers Modal - Outside of z-index container */}
      {selectedTokenStakers && (
        <div className="modal modal-open" style={{ zIndex: 9999 }}>
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              {selectedTokenStakers.token.name} ($
              {selectedTokenStakers.token.symbol}) Stakers
            </h3>

            {/* Search and Filters */}
            <div className="mb-4 space-y-4">
              {/* Search Input */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Search by address or username
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Search address or Farcaster username..."
                  className="input input-bordered w-full text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Type</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={filterType}
                    onChange={(e) =>
                      setFilterType(
                        e.target.value as "all" | "stakers" | "holders"
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="stakers">Stakers Only</option>
                    <option value="holders">Holders Only</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Farcaster</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={filterFarcaster}
                    onChange={(e) =>
                      setFilterFarcaster(
                        e.target.value as "all" | "with" | "without"
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="with">With Farcaster</option>
                    <option value="without">Without Farcaster</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Connection</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={filterConnection}
                    onChange={(e) =>
                      setFilterConnection(
                        e.target.value as "all" | "connected" | "not_connected"
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="connected">Connected</option>
                    <option value="not_connected">Not Connected</option>
                  </select>
                </div>

                {/* Clear Filters Button */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">&nbsp;</span>
                  </label>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterType("all");
                      setFilterFarcaster("all");
                      setFilterConnection("all");
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Results Counter */}
            <div className="mb-2 text-sm opacity-70">
              Showing{" "}
              {stakersWithFarcaster
                ? getFilteredAndSortedStakers(stakersWithFarcaster).length
                : selectedTokenStakers.token.stakers
                ? getFilteredAndSortedStakers(
                    selectedTokenStakers.token.stakers
                  ).length
                : 0}{" "}
              of {selectedTokenStakers.token.totalStakers || 0} holders
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleStakersSort("address")}
                    >
                      <div className="flex items-center gap-2">
                        Holder / Farcaster
                        {stakersSortBy === "address" && (
                          <span className="text-primary">
                            {stakersSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleStakersSort("units")}
                    >
                      <div className="flex items-center gap-2">
                        Staked Balance
                        {stakersSortBy === "units" && (
                          <span className="text-primary">
                            {stakersSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleStakersSort("status")}
                    >
                      <div className="flex items-center gap-2">
                        Type
                        {stakersSortBy === "status" && (
                          <span className="text-primary">
                            {stakersSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer select-none hover:bg-base-200"
                      onClick={() => handleStakersSort("joined")}
                    >
                      <div className="flex items-center gap-2">
                        Last Updated
                        {stakersSortBy === "joined" && (
                          <span className="text-primary">
                            {stakersSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(stakersWithFarcaster
                    ? getFilteredAndSortedStakers(stakersWithFarcaster)
                    : selectedTokenStakers.token.stakers
                    ? getFilteredAndSortedStakers(
                        selectedTokenStakers.token.stakers
                      )
                    : []
                  ).map((staker, index) => (
                    <tr key={`${staker.account.id}-${index}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          {staker.farcasterUser &&
                            staker.farcasterUser.pfp_url && (
                              <div className="avatar">
                                <div className="mask mask-squircle w-8 h-8">
                                  <Image
                                    src={staker.farcasterUser.pfp_url}
                                    alt={
                                      staker.farcasterUser.username || "User"
                                    }
                                    width={32}
                                    height={32}
                                    unoptimized
                                  />
                                </div>
                              </div>
                            )}
                          <div>
                            <a
                              href={`https://basescan.org/address/${staker.account.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary font-mono"
                            >
                              {staker.account.id
                                ? `${staker.account.id.slice(
                                    0,
                                    6
                                  )}...${staker.account.id.slice(-4)}`
                                : "Unknown"}
                            </a>
                            {staker.farcasterUser &&
                              staker.farcasterUser.username && (
                                <div className="text-sm opacity-70">
                                  @{staker.farcasterUser.username}
                                </div>
                              )}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono">
                        {parseInt(staker.units).toLocaleString()}
                      </td>
                      <td>
                        <div
                          className={`badge ${
                            staker.isConnected
                              ? "badge-success"
                              : "badge-warning"
                          }`}
                        >
                          {staker.isConnected ? "Connected" : "Not Connected"}
                        </div>
                      </td>
                      <td className="opacity-50">
                        {new Date(
                          parseInt(staker.createdAtTimestamp) * 1000
                        ).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {(stakersWithFarcaster ||
                    selectedTokenStakers.token.stakers) &&
                    (stakersWithFarcaster
                      ? getFilteredAndSortedStakers(stakersWithFarcaster)
                      : selectedTokenStakers.token.stakers
                      ? getFilteredAndSortedStakers(
                          selectedTokenStakers.token.stakers
                        )
                      : []
                    ).length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center opacity-50">
                          No holders found
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setSelectedTokenStakers(null);
                  setStakersWithFarcaster(null); // Reset Farcaster data
                  // Reset filters when closing modal
                  setSearchTerm("");
                  setFilterType("all");
                  setFilterFarcaster("all");
                  setFilterConnection("all");
                }}
              >
                Close
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setSelectedTokenStakers(null);
              setStakersWithFarcaster(null); // Reset Farcaster data
              // Reset filters when closing modal
              setSearchTerm("");
              setFilterType("all");
              setFilterFarcaster("all");
              setFilterConnection("all");
            }}
          >
            {" "}
          </div>
        </div>
      )}

      {/* Launch Token Modal */}
      <LaunchTokenModal
        isOpen={isLaunchTokenOpen}
        onClose={() => setIsLaunchTokenOpen(false)}
      />

      {/* Vault Management Modal */}
      {vaultModalState.isOpen && vaultModalState.token && (
        <UpdateVaultBeneficiaryModal
          isOpen={vaultModalState.isOpen}
          onClose={() => setVaultModalState({ isOpen: false })}
          tokenAddress={vaultModalState.token.contract_address}
          adminAddress={deployerAddress || ""}
          tokenSymbol={vaultModalState.token.symbol}
        />
      )}
    </>
  );
}
