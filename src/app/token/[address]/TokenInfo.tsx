"use client";

import Image from "next/image";
import SafeImage from "@/src/components/SafeImage";
import { Token } from "@/src/app/types/token";
import { useState, useEffect, useMemo, memo } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import DexscreenerIcon from "@/public/dexscreener.webp";
import InterfaceIcon from "@/public/interface.png";
import { useRewardCounter } from "@/src/hooks/useStreamingNumber";
import { useNavigation } from "@/src/hooks/useNavigation";
import { ClaimVaultButton } from "@/src/components/ClaimVaultButton";
import FarcasterIcon from "@/public/farcaster.svg";

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

const formatCurrency = (value: number | undefined) => {
  if (!value || isNaN(value)) return "-";
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

const DEFAULT_TOTAL_SUPPLY = 100_000_000_000; // 100B tokens - matches launch config

type VaultLike = {
  allocation?: number;
  beneficiary?: string | string[];
  admin?: string;
  supply?: number;
  lockDuration?: number;
  lockupDuration?: number;
  vestingDuration?: number;
  vault?: string;
  pool?: string;
  box?: string;
  lockupEndTime?: number;
  vestingEndTime?: number;
};

interface NormalizedVault {
  id: string;
  index: number;
  allocation?: number;
  supply?: number;
  lockDuration: number;
  vestingDuration: number;
  beneficiaries: string[];
  adminAddress?: string;
  vaultAddress?: string;
  pool?: string;
  box?: string;
  lockupEndTime?: number;
  vestingEndTime?: number;
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 1) return "N/A";

  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (seconds >= 60) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const wholeSeconds = Math.round(seconds);
  return `${wholeSeconds} second${wholeSeconds === 1 ? "" : "s"}`;
};

const formatPercent = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "-";

  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
    return `${Math.round(rounded)}%`;
  }
  return `${rounded.toFixed(2)}%`;
};

const shortenAddress = (address: string) => {
  if (!address) return "";
  return address.length > 10
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;
};

// Validate if a string is a valid URL
const isValidUrl = (urlString: string | undefined): boolean => {
  if (!urlString) return false;
  try {
    // Allow relative paths starting with /
    if (urlString.startsWith("/")) return true;
    // For absolute URLs, try to construct URL object
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
};

interface TokenInfoProps {
  token: Token;
  onShare?: () => Promise<void>;
  isMiniAppView?: boolean;
}

export function TokenInfo({ token, onShare, isMiniAppView }: TokenInfoProps) {
  const [initialRewards, setInitialRewards] = useState<number>(0);
  const [totalStakers, setTotalStakers] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  // Use the reward counter hook for animated rewards
  const { currentRewards } = useRewardCounter(
    initialRewards,
    REWARDS_PER_SECOND,
    150 // Balanced between performance and smoothness
  );

  useEffect(() => {
    calculateRewards(
      token.created_at,
      token.contract_address,
      token.staking_pool
    ).then(({ totalStreamed, totalStakers: stakers }) => {
      setInitialRewards(totalStreamed);
      setTotalStakers(stakers);
    });
  }, [token.created_at, token.contract_address, token.staking_pool]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(token.contract_address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const handleShareLink = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const { openExternalUrl } = useNavigation();

  const handleDexscreenerLink = async () => {
    const dexscreenerUrl = `https://dexscreener.com/base/${token.contract_address}`;
    await openExternalUrl(dexscreenerUrl);
  };

  const handleInterfaceLink = async () => {
    const interfaceUrl = `https://app.interface.social/token/8453/${token.contract_address}`;
    await openExternalUrl(interfaceUrl);
  };
  const creatorInfo = useMemo(() => {
    const normalizedHandle =
      (token.creator?.name || token.username || "").trim().replace(/^@+/, "") ||
      undefined;

    const handleLabel = normalizedHandle ? `@${normalizedHandle}` : undefined;

    const metadataDeployer =
      token.metadata &&
      typeof token.metadata === "object" &&
      token.metadata !== null &&
      typeof (token.metadata as { deployer?: string }).deployer === "string"
        ? ((token.metadata as { deployer?: string }).deployer as string)
        : undefined;

    const extendedToken = token as Token & { deployer?: string };
    const deployerAddress =
      extendedToken.deployer ||
      metadataDeployer ||
      token.staking_address ||
      token.pool_address ||
      token.contract_address;

    const fid =
      typeof token.requestor_fid === "number" ? token.requestor_fid : undefined;

    const initial =
      normalizedHandle?.[0]?.toUpperCase() ??
      token.symbol?.[0]?.toUpperCase() ??
      (deployerAddress ? deployerAddress.slice(2, 3).toUpperCase() : "?");

    return {
      label: handleLabel ?? shortenAddress(deployerAddress),
      avatarUrl:
        token.creator?.profileImage?.trim() ||
        token.pfp_url?.trim() ||
        undefined,
      profileUrl:
        handleLabel && fid
          ? `https://farcaster.xyz/${normalizedHandle}`
          : undefined,
      isWalletLabel: !handleLabel,
      initial,
    };
  }, [token]);

  const headerData = useMemo(
    () => ({
      tokenName: token.name,
      tokenSymbol: token.symbol,
      tokenImageUrl: token.img_url ?? undefined,
      creatorLabel: creatorInfo?.label,
      creatorAvatarUrl: creatorInfo?.avatarUrl,
      creatorFallbackInitial:
        creatorInfo?.initial ??
        token.symbol?.[0]?.toUpperCase() ??
        (token.contract_address
          ? token.contract_address.slice(2, 3).toUpperCase()
          : "?"),
      creatorProfileUrl: creatorInfo?.profileUrl,
      hideCreatorAvatar: !!creatorInfo?.isWalletLabel,
    }),
    [
      token.name,
      token.symbol,
      token.img_url,
      token.contract_address,
      creatorInfo,
    ]
  );

  const renderVaultDetails = (vault: NormalizedVault) => {
    const beneficiaryCount = vault.beneficiaries.length;
    const hasBeneficiaries = beneficiaryCount > 0;

    return (
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-xs uppercase opacity-60 block">
              Allocation
            </span>
            <span className="font-mono font-semibold text-base">
              {vault.allocation !== undefined
                ? formatPercent(vault.allocation)
                : "-"}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase opacity-60 block">Supply</span>
            <span className="font-mono font-semibold text-base">
              {vault.supply !== undefined ? vault.supply.toLocaleString() : "-"}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase opacity-60 block">
              Lock Duration
            </span>
            <span className="font-mono font-semibold text-base">
              {formatDuration(vault.lockDuration)}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase opacity-60 block">
              Vesting Duration
            </span>
            <span className="font-mono font-semibold text-base">
              {formatDuration(vault.vestingDuration)}
            </span>
          </div>
        </div>

        <div>
          <span className="text-xs uppercase opacity-60 block mb-1">
            {hasBeneficiaries
              ? `Beneficiaries (${beneficiaryCount})`
              : "Beneficiaries"}
          </span>
          {hasBeneficiaries ? (
            <div className="flex flex-wrap gap-2">
              {vault.beneficiaries.map((beneficiary, index) => (
                <a
                  key={`${beneficiary}-${index}`}
                  href={`https://basescan.org/address/${beneficiary}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge badge-outline font-mono text-xs"
                >
                  {shortenAddress(beneficiary)}
                </a>
              ))}
            </div>
          ) : (
            <span className="font-mono opacity-60">-</span>
          )}
        </div>

        {vault.adminAddress && (
          <ClaimVaultButton
            tokenAddress={token.contract_address}
            adminAddress={vault.adminAddress}
            className="btn btn-sm btn-outline btn-secondary w-full md:w-auto"
          />
        )}

        <div>
          <div className="text-xs uppercase opacity-60 mb-2">
            Vesting Timeline
          </div>
          <div className="w-full">
            {vault.vestingDuration > 0 ? (
              (() => {
                const startTime = token.timestamp
                  ? new Date(token.timestamp._seconds * 1000)
                  : new Date(token.created_at);
                const vestingDuration = Math.max(vault.vestingDuration, 0);
                const safeLockDuration = Math.max(
                  0,
                  Math.min(vault.lockDuration, vestingDuration)
                );
                const lockEndTime = new Date(
                  startTime.getTime() + safeLockDuration * 1000
                );
                const vestEndTime = new Date(
                  startTime.getTime() + vestingDuration * 1000
                );
                const now = new Date();
                const totalDurationMs = vestingDuration * 1000;
                const progressPercentRaw =
                  totalDurationMs > 0
                    ? (now.getTime() - startTime.getTime()) / totalDurationMs
                    : 0;
                const progressPercent = Math.min(
                  Math.max(progressPercentRaw * 100, 0),
                  100
                );

                return (
                  <>
                    <div className="w-full h-2 bg-base-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs opacity-70 mt-1">
                      <span>
                        Lock Ends:{" "}
                        {lockEndTime.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>
                        Vesting Ends:{" "}
                        {vestEndTime.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </>
                );
              })()
            ) : (
              <span className="text-xs opacity-70">
                No vesting schedule. Distribution occurs on claim.
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const buildVaultSummaryMeta = (vault: NormalizedVault) => {
    const parts: string[] = [];
    if (vault.allocation !== undefined) {
      parts.push(formatPercent(vault.allocation));
    }
    if (vault.lockDuration > 0) {
      parts.push(`Lock ${formatDuration(vault.lockDuration)}`);
    }
    if (vault.vestingDuration > 0) {
      parts.push(`Vest ${formatDuration(vault.vestingDuration)}`);
    }
    return parts.join(" • ");
  };

  const hasVaultsArray = Array.isArray(token.vaults) && token.vaults.length > 0;
  const vaultEntries: VaultLike[] = hasVaultsArray
    ? (token.vaults as VaultLike[])
    : token.vault
    ? ([token.vault] as VaultLike[])
    : [];

  const normalizedVaults: NormalizedVault[] = vaultEntries.map(
    (vault, index) => {
      const rawLockDuration =
        typeof vault.lockDuration === "number"
          ? vault.lockDuration
          : typeof vault.lockupDuration === "number"
          ? vault.lockupDuration
          : 0;

      const normalizedLockDuration = rawLockDuration > 1 ? rawLockDuration : 0;

      const vestingDuration =
        typeof vault.vestingDuration === "number" ? vault.vestingDuration : 0;

      const supply =
        typeof vault.supply === "number" && !Number.isNaN(vault.supply)
          ? vault.supply
          : undefined;

      let allocation =
        supply !== undefined
          ? (supply / DEFAULT_TOTAL_SUPPLY) * 100
          : typeof vault.allocation === "number" &&
            !Number.isNaN(vault.allocation)
          ? vault.allocation
          : undefined;

      if (allocation !== undefined) {
        allocation = Math.min(Math.max(allocation, 0), 100);
      }

      const beneficiariesRaw = Array.isArray(vault.beneficiary)
        ? vault.beneficiary
        : vault.beneficiary
        ? [vault.beneficiary]
        : vault.admin
        ? [vault.admin]
        : [];

      const beneficiaries = beneficiariesRaw.filter(
        (address): address is string =>
          typeof address === "string" && address.length > 0
      );

      const adminAddress =
        typeof vault.admin === "string" && vault.admin.length > 0
          ? vault.admin
          : undefined;
      const vaultAddress =
        typeof vault.vault === "string" && vault.vault.length > 0
          ? vault.vault
          : undefined;
      const pool =
        typeof vault.pool === "string" && vault.pool.length > 0
          ? vault.pool
          : undefined;
      const box =
        typeof vault.box === "string" && vault.box.length > 0
          ? vault.box
          : undefined;
      const lockupEndTime =
        typeof vault.lockupEndTime === "number" && vault.lockupEndTime > 0
          ? vault.lockupEndTime
          : undefined;
      const vestingEndTime =
        typeof vault.vestingEndTime === "number" && vault.vestingEndTime > 0
          ? vault.vestingEndTime
          : undefined;

      return {
        id: `vault-${index}`,
        index: index + 1,
        allocation,
        supply,
        lockDuration: normalizedLockDuration,
        vestingDuration,
        beneficiaries,
        adminAddress,
        vaultAddress,
        pool,
        box,
        lockupEndTime,
        vestingEndTime,
      };
    }
  );

  const totalVaultAllocationPercent = normalizedVaults.reduce(
    (sum, vault) => sum + (vault.allocation ?? 0),
    0
  );

  const stakingAllocationPercent =
    token.allocations?.staking ??
    (typeof token.staking?.supply === "number"
      ? (token.staking.supply / DEFAULT_TOTAL_SUPPLY) * 100
      : undefined);

  let vaultAllocationPercent =
    totalVaultAllocationPercent > 0 ? totalVaultAllocationPercent : undefined;
  if (
    vaultAllocationPercent === undefined &&
    typeof token.allocations?.vault === "number"
  ) {
    vaultAllocationPercent = token.allocations.vault;
  }

  // Always calculate LP as remainder: 100 - Staking - Vault
  let liquidityAllocationPercent: number | undefined;

  if (
    stakingAllocationPercent !== undefined ||
    vaultAllocationPercent !== undefined
  ) {
    const knownAllocation =
      (stakingAllocationPercent ?? 0) + (vaultAllocationPercent ?? 0);
    liquidityAllocationPercent = Math.max(0, 100 - knownAllocation);
  }

  const allocationSegments = [
    {
      key: "staking",
      label: "Staking",
      percent:
        typeof stakingAllocationPercent === "number"
          ? Math.max(stakingAllocationPercent, 0)
          : undefined,
      barClass: "bg-primary",
      textClass: "text-white",
      dotClass: "bg-primary",
    },
    {
      key: "vault",
      label: "Vault",
      percent:
        typeof vaultAllocationPercent === "number"
          ? Math.max(vaultAllocationPercent, 0)
          : undefined,
      barClass: "bg-secondary",
      textClass: "text-white",
      dotClass: "bg-secondary",
    },
    {
      key: "liquidity",
      label: "LP",
      percent:
        typeof liquidityAllocationPercent === "number"
          ? Math.max(liquidityAllocationPercent, 0)
          : undefined,
      barClass: "bg-accent",
      textClass: "text-white",
      dotClass: "bg-accent",
    },
  ] as const;

  const allocationTotal = allocationSegments.reduce(
    (sum, segment) => sum + (segment.percent ?? 0),
    0
  );

  const allocationSegmentsWithWidth = allocationSegments.map((segment) => {
    const width =
      segment.percent !== undefined && allocationTotal > 0
        ? Math.min((segment.percent / allocationTotal) * 100, 100)
        : 0;
    return {
      ...segment,
      width,
    };
  });

  const hasAllocationData = allocationSegmentsWithWidth.some(
    (segment) => segment.percent !== undefined && segment.percent > 0
  );

  return (
    <div
      className={`card bg-base-100 border border-base-300 p-6 relative z-10 ${
        isMiniAppView ? "mt-0" : "mt-16 md:mt-0"
      }`}
    >
      {/* Share Dropdown - Top Right Corner */}
      {onShare && (
        <div className="dropdown dropdown-end absolute top-4 right-4 z-20">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-sm gap-2"
            title="Share options"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
              />
            </svg>
            Share
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow border border-base-300"
          >
            <li>
              <button onClick={onShare} className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#845FC9"
                    d="M18.24.24H5.76A5.76 5.76 0 0 0 0 6v12a5.76 5.76 0 0 0 5.76 5.76h12.48A5.76 5.76 0 0 0 24 18V6A5.76 5.76 0 0 0 18.24.24m.816 17.166v.504a.49.49 0 0 1 .543.48v.568h-5.143v-.569A.49.49 0 0 1 15 17.91v-.504c0-.22.153-.402.358-.458l-.01-4.364c-.158-1.737-1.64-3.098-3.443-3.098s-3.285 1.361-3.443 3.098l-.01 4.358c.228.042.532.208.54.464v.504a.49.49 0 0 1 .543.48v.568H4.392v-.569a.49.49 0 0 1 .543-.479v-.504c0-.253.201-.454.454-.472V9.039h-.49l-.61-2.031H6.93V5.042h9.95v1.966h2.822l-.61 2.03h-.49v7.896c.252.017.453.22.453.472"
                  />
                </svg>
                Share on Farcaster
              </button>
            </li>
            <li>
              <button
                onClick={handleShareLink}
                className={`flex items-center gap-2 ${
                  shareSuccess ? "text-success" : ""
                }`}
              >
                {shareSuccess ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                    />
                  </svg>
                )}
                {shareSuccess ? "Copied!" : "Copy Link"}
              </button>
            </li>
          </ul>
        </div>
      )}

      <TokenHeader {...headerData} />

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6">
        <div>
          <div className="text-xs sm:text-sm opacity-60">Price</div>
          <div className="font-mono text-lg sm:text-xl md:text-2xl font-bold break-words">
            {formatPrice(token.price)}
          </div>
        </div>
        <div>
          <div className="text-xs sm:text-sm opacity-60">24h Change</div>
          <div
            className={`font-mono text-lg sm:text-xl md:text-2xl font-bold ${
              token.change24h && token.change24h >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {token.change24h
              ? `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(
                  2
                )}%`
              : "-"}
          </div>
        </div>
        <div>
          <div className="text-xs sm:text-sm opacity-60">24h Volume</div>
          <div className="font-mono text-lg sm:text-xl md:text-2xl font-bold break-words">
            {formatCurrency(token.volume24h)}
          </div>
        </div>
        <div>
          <div className="text-xs sm:text-sm opacity-60">Market Cap</div>
          <div className="font-mono text-lg sm:text-xl md:text-2xl font-bold break-words">
            {formatCurrency(token.marketCap)}
          </div>
        </div>
      </div>

      {/* Total Rewards - Full Width */}
      <div className="mb-6">
        <div className="text-xs sm:text-sm opacity-60">
          Total Rewards Distributed ({totalStakers}{" "}
          {totalStakers === 1 ? "staker" : "stakers"})
        </div>
        <div className="font-mono text-lg sm:text-xl md:text-2xl font-bold break-words">
          {currentRewards.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>

      {/* Info Section */}
      <div className="mb-6">
        {/* Description */}
        {token.description && (
          <div className="text-sm leading-relaxed mb-4">
            {token.description}
          </div>
        )}

        {/* Token Info Dropdown */}
        {(token.allocations ||
          token.staking ||
          token.vault ||
          token.vaults) && (
          <details className="collapse collapse-arrow bg-base-200 rounded-lg mb-4">
            <summary className="collapse-title text-base font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Allocation & Distribution</span>
                {(token.type === "v1" || token.type === "v2") && (
                  <span
                    className={`text-white px-2 py-0.5 rounded text-xs font-semibold ${
                      token.type === "v2" ? "bg-primary" : "bg-secondary"
                    }`}
                  >
                    {token.type}
                  </span>
                )}
              </div>
            </summary>
            <div className="collapse-content">
              {/* Token Allocation (v2 tokens) */}
              {hasAllocationData && (
                <div className="mb-6">
                  <div className="text-sm opacity-60 mb-3">
                    Token Allocation
                  </div>
                  <div className="w-full h-6 flex rounded overflow-hidden mb-3">
                    {allocationSegmentsWithWidth.map((segment) => {
                      if (
                        segment.percent === undefined ||
                        segment.percent <= 0
                      ) {
                        return null;
                      }
                      return (
                        <div
                          key={segment.key}
                          className={`${segment.barClass} flex items-center justify-center text-xs font-semibold ${segment.textClass} transition-all`}
                          style={{ width: `${segment.width}%` }}
                          title={`${segment.label}: ${formatPercent(
                            segment.percent
                          )}`}
                        >
                          {segment.percent > 12 &&
                            formatPercent(segment.percent)}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 text-xs">
                    {allocationSegmentsWithWidth.map((segment) => (
                      <div
                        key={`${segment.key}-legend`}
                        className="flex items-center gap-1.5"
                      >
                        <div
                          className={`w-2 h-2 ${segment.dotClass} rounded`}
                        ></div>
                        <span className="opacity-60">{segment.label}</span>
                        <span className="font-mono font-semibold">
                          {segment.percent !== undefined
                            ? formatPercent(segment.percent)
                            : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Staking & Vault Configuration (v2 tokens) - Two Columns */}
              {(token.staking || token.vault || token.vaults) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  {/* Staking Configuration */}
                  {token.staking && (
                    <div>
                      <div className="text-sm opacity-60 font-bold mb-3">
                        <span>Staking Rewards</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {token.staking.allocation !== undefined && (
                          <div>
                            <span className="text-sm opacity-60">
                              Allocation:{" "}
                            </span>
                            <span className="font-mono font-semibold">
                              {token.staking.allocation}% (
                              {token.staking.supply.toLocaleString()})
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-sm opacity-60">Lock: </span>
                          <span className="font-mono font-semibold">
                            {formatDuration(token.staking.lockDuration)}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm opacity-60">
                            Flow Duration:{" "}
                          </span>
                          <span className="font-mono font-semibold">
                            {token.staking.flowDuration >= 86400
                              ? `>${(
                                  token.staking.flowDuration / 86400
                                ).toFixed(0)} day${
                                  token.staking.flowDuration / 86400 !== 1
                                    ? "s"
                                    : ""
                                }`
                              : `>${(token.staking.flowDuration / 3600).toFixed(
                                  0
                                )} hour${
                                  token.staking.flowDuration / 3600 !== 1
                                    ? "s"
                                    : ""
                                }`}
                          </span>
                        </div>
                        {token.staking.delegate && (
                          <div>
                            <span className="text-sm opacity-60">
                              Delegate:{" "}
                            </span>
                            <a
                              href={`https://basescan.org/address/${token.staking.delegate}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono link link-primary"
                            >
                              {token.staking.delegate.slice(0, 6)}...
                              {token.staking.delegate.slice(-4)}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Vault Configuration */}
                  {normalizedVaults.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-sm opacity-60 font-bold">
                        {normalizedVaults.length > 1 ? "Vaults" : "Vault"}
                      </div>

                      {normalizedVaults.length === 1 ? (
                        renderVaultDetails(normalizedVaults[0])
                      ) : (
                        <div className="space-y-2">
                          {normalizedVaults.map((vault) => {
                            const summaryMeta = buildVaultSummaryMeta(vault);

                            return (
                              <details
                                key={vault.id}
                                className="group collapse bg-base-200 rounded-lg border border-base-300"
                              >
                                <summary className="collapse-title text-sm font-semibold py-2 flex items-center justify-between gap-3 [&::marker]:hidden [&::-webkit-details-marker]:hidden">
                                  <div className="flex items-baseline gap-3">
                                    <span className="font-semibold">
                                      Vault {vault.index}
                                    </span>
                                    {summaryMeta && (
                                      <span className="text-xs font-normal opacity-70">
                                        {summaryMeta}
                                      </span>
                                    )}
                                  </div>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                                  >
                                    <path d="M6 9l6 6 6-6" />
                                  </svg>
                                </summary>
                                <div className="collapse-content pt-0">
                                  {renderVaultDetails(vault)}
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* External Links - Horizontal Buttons */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={handleCopyAddress}
          className={`btn btn-sm gap-2 ${
            copySuccess ? "btn-success" : "btn-ghost border border-base-300"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {copySuccess ? "Copied!" : "CA"}
        </button>

        <button
          onClick={handleDexscreenerLink}
          className="btn btn-sm btn-ghost border border-base-300 gap-2"
        >
          <Image
            src={DexscreenerIcon}
            alt="Dexscreener"
            width={16}
            height={16}
          />
          Dexscreener
        </button>

        <button
          onClick={handleInterfaceLink}
          className="btn btn-sm btn-ghost border border-base-300 gap-2"
        >
          <Image src={InterfaceIcon} alt="Interface" width={16} height={16} />
          Interface
        </button>
      </div>

      {/* Website Link for BUTTHOLE token */}
      {token.contract_address.toLowerCase() ===
        "0x1c4f69f14cf754333c302246d25a48a13224118a" && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => openExternalUrl("https://butthole.stream")}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
            title="Visit official website"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9"
              />
            </svg>
            Website
          </button>

          <button
            onClick={() => openExternalUrl("https://x.com/BUTTHOLE_HQ")}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
            title="Follow on X (Twitter)"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              role="img"
              viewBox="0 0 24 24"
              className="w-2 h-2"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path>
            </svg>
            @BUTTHOLE_HQ
          </button>

          <button
            onClick={() => openExternalUrl("https://t.me/buttholehq")}
            className="btn btn-outline btn-sm border-primary/10 flex items-center gap-2 hover:bg-primary/10"
            title="Join Telegram"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 32 32"
            >
              <path d="M16 0.5c-8.563 0-15.5 6.938-15.5 15.5s6.938 15.5 15.5 15.5c8.563 0 15.5-6.938 15.5-15.5s-6.938-15.5-15.5-15.5zM23.613 11.119l-2.544 11.988c-0.188 0.85-0.694 1.056-1.4 0.656l-3.875-2.856-1.869 1.8c-0.206 0.206-0.381 0.381-0.781 0.381l0.275-3.944 7.181-6.488c0.313-0.275-0.069-0.431-0.482-0.156l-8.875 5.587-3.825-1.194c-0.831-0.262-0.85-0.831 0.175-1.231l14.944-5.763c0.694-0.25 1.3 0.169 1.075 1.219z" />
            </svg>
            Telegram
          </button>
        </div>
      )}
    </div>
  );
}
interface TokenHeaderProps {
  tokenName: string;
  tokenSymbol: string;
  tokenImageUrl?: string;
  creatorLabel?: string;
  creatorAvatarUrl?: string;
  creatorFallbackInitial: string;
  creatorProfileUrl?: string;
  hideCreatorAvatar?: boolean;
}

const TokenHeader = memo(function TokenHeader({
  tokenName,
  tokenSymbol,
  tokenImageUrl,
  creatorLabel,
  creatorAvatarUrl,
  creatorFallbackInitial,
  creatorProfileUrl,
  hideCreatorAvatar = false,
}: TokenHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        {tokenImageUrl && isValidUrl(tokenImageUrl) ? (
          <div className="relative w-14 h-14 flex-shrink-0">
            <SafeImage
              src={tokenImageUrl}
              alt={tokenName}
              fill
              className="object-cover rounded-lg"
            />
          </div>
        ) : (
          <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center text-xl font-mono flex-shrink-0">
            {tokenSymbol?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-tight">{tokenName}</h2>
          <div className="text-base opacity-60 mt-1">
            $
            {tokenSymbol?.startsWith("$")
              ? tokenSymbol.substring(1)
              : tokenSymbol}
          </div>
        </div>
      </div>

      {creatorLabel && (
        <div className="mb-6">
          {creatorProfileUrl ? (
            <a
              href={creatorProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="View on Farcaster"
            >
              {!hideCreatorAvatar && (
                <div className="avatar">
                  {creatorAvatarUrl && isValidUrl(creatorAvatarUrl) ? (
                    <div className="w-6 h-6 rounded-full overflow-hidden">
                      <SafeImage
                        src={creatorAvatarUrl}
                        alt={creatorLabel}
                        width={24}
                        height={24}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {creatorFallbackInitial}
                    </div>
                  )}
                </div>
              )}
              <span className="text-sm font-medium">{creatorLabel}</span>
              <Image
                src={FarcasterIcon}
                alt="Farcaster profile"
                width={14}
                height={14}
              />
            </a>
          ) : (
            <div className="flex items-center gap-2">
              {!hideCreatorAvatar && (
                <div className="avatar">
                  {creatorAvatarUrl && isValidUrl(creatorAvatarUrl) ? (
                    <div className="w-6 h-6 rounded-full overflow-hidden">
                      <SafeImage
                        src={creatorAvatarUrl}
                        alt={creatorLabel}
                        width={24}
                        height={24}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {creatorFallbackInitial}
                    </div>
                  )}
                </div>
              )}
              <span className="text-sm font-medium">{creatorLabel}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
});
