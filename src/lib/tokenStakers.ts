export interface TokenStaker {
  address: string;
  units: string;
  percentage: number;
  isConnected: boolean;
  fid?: number;
  username?: string;
  display_name?: string;
  pfp_url?: string | null;
  createdAtTimestamp?: string;
}

interface FarcasterUser {
  fid?: number;
  username?: string;
  display_name?: string;
  pfp_url?: string | null;
}

interface RawTokenStaker {
  account?: string | { id?: string };
  address?: string;
  holder_address?: string;
  units?: string;
  balance?: string;
  staked_balance?: number;
  percentage?: number;
  isConnected?: boolean;
  isStaker?: boolean;
  createdAtTimestamp?: string;
  timestamp?: string;
  lastUpdated?: {
    _seconds?: number;
  };
  farcaster?: FarcasterUser;
  farcasterUser?: FarcasterUser;
  fid?: number;
  username?: string;
  display_name?: string;
  pfp_url?: string | null;
  profileImage?: string | null;
}

export function normalizeTokenStakers(data: unknown): TokenStaker[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => normalizeTokenStaker(item))
    .filter((staker): staker is TokenStaker => staker !== null);
}

function normalizeTokenStaker(item: unknown): TokenStaker | null {
  if (!item || typeof item !== "object") return null;

  const staker = item as RawTokenStaker;
  const accountAddress =
    typeof staker.account === "string" ? staker.account : staker.account?.id;
  const address = staker.address || staker.holder_address || accountAddress;

  if (!address || staker.isStaker === false) return null;

  const farcaster = staker.farcaster || staker.farcasterUser;
  const units =
    staker.units ??
    (staker.staked_balance !== undefined
      ? staker.staked_balance.toString()
      : staker.balance ?? "0");
  const pfpUrl =
    farcaster?.pfp_url !== undefined
      ? farcaster.pfp_url
      : staker.pfp_url !== undefined
        ? staker.pfp_url
        : staker.profileImage;

  return {
    address,
    units,
    percentage: staker.percentage ?? 0,
    isConnected: staker.isConnected ?? true,
    fid: farcaster?.fid ?? staker.fid,
    username: farcaster?.username ?? staker.username,
    display_name:
      farcaster?.display_name ?? staker.display_name ?? farcaster?.username,
    pfp_url: pfpUrl,
    createdAtTimestamp:
      staker.createdAtTimestamp ??
      staker.timestamp ??
      staker.lastUpdated?._seconds?.toString() ??
      "0",
  };
}
