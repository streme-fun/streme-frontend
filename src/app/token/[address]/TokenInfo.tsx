"use client";

import Image from "next/image";
import SafeImage from "@/src/components/SafeImage";
import { Token } from "@/src/app/types/token";
import { useState, useEffect } from "react";
import { calculateRewards, REWARDS_PER_SECOND } from "@/src/lib/rewards";
import DexscreenerIcon from "@/public/dexscreener.webp";
import InterfaceIcon from "@/public/interface.png";
import { useRewardCounter } from "@/src/hooks/useStreamingNumber";
import { useNavigation } from "@/src/hooks/useNavigation";

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
};

interface NormalizedVault {
  id: string;
  index: number;
  allocation?: number;
  supply?: number;
  lockDuration: number;
  vestingDuration: number;
  beneficiaries: string[];
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

  const hasVaultsArray =
    Array.isArray(token.vaults) && token.vaults.length > 0;
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

      const normalizedLockDuration =
        rawLockDuration > 1 ? rawLockDuration : 0;

      const vestingDuration =
        typeof vault.vestingDuration === "number" ? vault.vestingDuration : 0;

      const supply =
        typeof vault.supply === "number" && !Number.isNaN(vault.supply)
          ? vault.supply
          : undefined;

      let allocation =
        supply !== undefined
          ? (supply / DEFAULT_TOTAL_SUPPLY) * 100
          : typeof vault.allocation === "number" && !Number.isNaN(vault.allocation)
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

      return {
        id: `vault-${index}`,
        index: index + 1,
        allocation,
        supply,
        lockDuration: normalizedLockDuration,
        vestingDuration,
        beneficiaries,
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

  let liquidityAllocationPercent =
    typeof token.allocations?.liquidity === "number"
      ? token.allocations.liquidity
      : undefined;

  if (liquidityAllocationPercent === undefined) {
    const knownAllocation =
      (stakingAllocationPercent ?? 0) + (vaultAllocationPercent ?? 0);
    if (
      stakingAllocationPercent !== undefined ||
      vaultAllocationPercent !== undefined
    ) {
      liquidityAllocationPercent = Math.max(0, 100 - knownAllocation);
    }
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

      {/* Token Header - Horizontal */}
      <div className="flex items-center gap-4 mb-6">
        {token.img_url && isValidUrl(token.img_url) ? (
          <div className="relative w-14 h-14 flex-shrink-0">
            <SafeImage
              src={token.img_url}
              alt={token.name}
              fill
              className="object-cover rounded-lg"
            />
          </div>
        ) : (
          <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center text-xl font-mono flex-shrink-0">
            {token.symbol?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-tight">{token.name}</h2>
          <div className="text-base opacity-60">
            $
            {token.symbol?.startsWith("$")
              ? token.symbol.substring(1)
              : token.symbol}
          </div>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <div className="text-sm opacity-60">Price</div>
          <div className="font-mono text-2xl font-bold">
            {formatPrice(token.price)}
          </div>
        </div>
        <div>
          <div className="text-sm opacity-60">24h Change</div>
          <div
            className={`font-mono text-2xl font-bold ${
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
          <div className="text-sm opacity-60">24h Volume</div>
          <div className="font-mono text-2xl font-bold">
            {formatCurrency(token.volume24h)}
          </div>
        </div>
        <div>
          <div className="text-sm opacity-60">Market Cap</div>
          <div className="font-mono text-2xl font-bold">
            {formatCurrency(token.marketCap)}
          </div>
        </div>
      </div>

      {/* Total Rewards - Full Width */}
      <div className="mb-6">
        <div className="text-sm opacity-60">
          Total Rewards Distributed ({totalStakers}{" "}
          {totalStakers === 1 ? "staker" : "stakers"})
        </div>
        <div className="font-mono text-2xl font-bold">
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
            <summary className="collapse-title text-base font-semibold">
              Allocation & Distribution
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
                        Staking Rewards
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
                  {normalizedVaults.length > 0 &&
                    normalizedVaults.map((vault) => {
                      const beneficiaryCount = vault.beneficiaries.length;

                      return (
                        <div key={vault.id}>
                          <div className="text-sm opacity-60 font-bold mb-3">
                            {hasVaultsArray ? `Vault ${vault.index}` : "Vault"}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-sm opacity-60">
                                Allocation:{" "}
                              </span>
                              <span className="font-mono font-semibold">
                                {vault.allocation !== undefined
                                  ? formatPercent(vault.allocation)
                                  : "-"}
                                {vault.supply !== undefined
                                  ? ` (${vault.supply.toLocaleString()})`
                                  : ""}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm opacity-60">Lock: </span>
                              <span className="font-mono font-semibold">
                                {formatDuration(vault.lockDuration)}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm opacity-60">
                                Vesting Duration:{" "}
                              </span>
                              <span className="font-mono font-semibold">
                                {formatDuration(vault.vestingDuration)}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm opacity-60">
                                {beneficiaryCount > 1
                                  ? `Beneficiaries (${beneficiaryCount}):`
                                  : "Beneficiary:"}
                              </span>
                              {beneficiaryCount > 0 ? (
                                <div className="flex flex-col gap-1 mt-1">
                                  {vault.beneficiaries.map(
                                    (beneficiary, index) => (
                                      <a
                                        key={`${beneficiary}-${index}`}
                                        href={`https://basescan.org/address/${beneficiary}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono link link-primary"
                                      >
                                        {shortenAddress(beneficiary)}
                                      </a>
                                    )
                                  )}
                                </div>
                              ) : (
                                <div className="font-mono opacity-60 mt-1">
                                  -
                                </div>
                              )}
                            </div>

                            {/* Vesting Timeline Chart */}
                            <div className="mt-4">
                              <div className="text-xs opacity-60 mb-2">
                                Vesting Timeline
                              </div>
                              <div className="w-full">
                                {vault.vestingDuration > 0 ? (
                                  (() => {
                                    const startTime = token.timestamp
                                      ? new Date(token.timestamp._seconds * 1000)
                                      : new Date(token.created_at);
                                    const vestingDuration = Math.max(
                                      vault.vestingDuration,
                                      0
                                    );
                                    const safeLockDuration = Math.max(
                                      0,
                                      Math.min(
                                        vault.lockDuration,
                                        vestingDuration
                                      )
                                    );
                                    const vestingWindow = Math.max(
                                      vestingDuration - safeLockDuration,
                                      0
                                    );
                                    const lockEndTime = new Date(
                                      startTime.getTime() +
                                        safeLockDuration * 1000
                                    );
                                    const vestEndTime = new Date(
                                      startTime.getTime() +
                                        vestingDuration * 1000
                                    );
                                    const now = new Date();
                                    const totalDurationMs =
                                      vestingDuration * 1000;
                                    const progressPercentRaw =
                                      totalDurationMs > 0
                                        ? (now.getTime() -
                                            startTime.getTime()) /
                                          totalDurationMs
                                        : 1;
                                    const progressPercent = Math.min(
                                      Math.max(progressPercentRaw * 100, 0),
                                      100
                                    );
                                    const lockPercent =
                                      vestingDuration > 0
                                        ? Math.min(
                                            (safeLockDuration /
                                              vestingDuration) *
                                              100,
                                            100
                                          )
                                        : 0;
                                    const vestPercent =
                                      vestingDuration > 0
                                        ? Math.max(100 - lockPercent, 0)
                                        : 0;
                                    const formatDateLabel = (date: Date) =>
                                      date.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      });

                                    return (
                                      <>
                                        <div className="w-full h-6 flex rounded overflow-hidden relative">
                                          {lockPercent > 0 && (
                                            <div
                                              className="bg-warning/30 border-r-2 border-warning flex items-center justify-center text-xs font-semibold"
                                              style={{
                                                width: `${lockPercent}%`,
                                              }}
                                              title={`Locked: ${formatDuration(
                                                safeLockDuration
                                              )}`}
                                            >
                                              {lockPercent > 15 && "Locked"}
                                            </div>
                                          )}
                                          {vestPercent > 0 && (
                                            <div
                                              className="bg-success/30 flex items-center justify-center text-xs font-semibold"
                                              style={{
                                                width: `${vestPercent}%`,
                                              }}
                                              title={`Vesting: ${formatDuration(
                                                vestingWindow
                                              )}`}
                                            >
                                              {vestPercent > 15 && "Vesting"}
                                            </div>
                                          )}
                                          {lockPercent === 0 &&
                                            vestPercent === 0 && (
                                              <div className="w-full h-full bg-base-300 flex items-center justify-center text-xs font-semibold text-base-content/60">
                                                No lockup
                                              </div>
                                            )}
                                          <div
                                            className="absolute top-0 left-0 h-full border-r-2 border-primary"
                                            style={{
                                              width: `${progressPercent}%`,
                                            }}
                                            title={`Progress: ${progressPercent.toFixed(
                                              1
                                            )}%`}
                                          />
                                        </div>
                                        <div className="flex justify-between text-xs opacity-60 mt-1">
                                          <span>{formatDateLabel(startTime)}</span>
                                          <span>{formatDateLabel(vestEndTime)}</span>
                                        </div>
                                        <div className="text-xs opacity-60 mt-1">
                                          {now < lockEndTime && "Status: Locked"}
                                          {now >= lockEndTime &&
                                            now < vestEndTime &&
                                            "Status: Actively Vesting"}
                                          {now >= vestEndTime &&
                                            "Status: Vesting Complete"}
                                        </div>
                                      </>
                                    );
                                  })()
                                ) : (
                                  <div className="text-xs opacity-60">
                                    No vesting schedule configured.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
