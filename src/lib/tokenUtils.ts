/**
 * Token utility functions for staking operations
 */

/**
 * Manually blocked token addresses (lowercase)
 * These tokens have staking disabled regardless of their type
 */
const MANUALLY_BLOCKED_ADDRESSES: string[] = [];

/**
 * Check if a token address is manually blocked from staking
 * @param tokenAddress - Token contract address
 * @returns true if token is manually blocked
 */
export const isTokenManuallyBlocked = (tokenAddress?: string): boolean => {
  if (!tokenAddress) return false;
  const normalized = tokenAddress.toLowerCase();
  return MANUALLY_BLOCKED_ADDRESSES.includes(normalized);
};

/**
 * Check if staking is disabled for a given token type or address
 * @param tokenType - Token type (v1, v2, v2aero, etc.)
 * @param tokenAddress - Token contract address (optional)
 * @returns true if staking should be disabled
 */
export const isStakingDisabled = (
  tokenType?: string,
  tokenAddress?: string
): boolean => {
  // Check manual blocklist first
  if (isTokenManuallyBlocked(tokenAddress)) {
    return true;
  }

  // v2/v2aero staking is now enabled
  return false;
};

export const isAerodromeToken = (tokenType?: string): boolean => {
  const normalizedType = tokenType?.toLowerCase();
  return normalizedType === "v2aero" || normalizedType === "v2aeronew";
};

export const isUniswapV4Token = (tokenType?: string): boolean => {
  return tokenType?.toLowerCase() === "v4uni";
};

export type ZapLpType = "uniswap" | "aero" | "uniswap-v4";

export const getZapLpType = (tokenType?: string): ZapLpType => {
  if (isAerodromeToken(tokenType)) return "aero";
  if (isUniswapV4Token(tokenType)) return "uniswap-v4";
  return "uniswap";
};

export const supportsZapStake = (tokenType?: string): boolean => {
  return !isUniswapV4Token(tokenType);
};

export const getGeckoTerminalPoolId = (token: {
  type?: string;
  pool_address?: string | null;
  pool_key?: string | null;
  contract_address?: string | null;
}): string | null => {
  if (token.pool_address) return token.pool_address;
  if (isUniswapV4Token(token.type)) {
    return token.pool_key || token.contract_address || null;
  }
  return null;
};

/**
 * Get user-facing message explaining why staking is disabled
 * @param tokenType - Token type
 * @param tokenAddress - Token contract address (optional)
 * @returns Message string or null if staking is allowed
 */
export const getStakingDisabledMessage = (
  tokenType?: string,
  tokenAddress?: string
): string | null => {
  if (isTokenManuallyBlocked(tokenAddress)) {
    return "Staking temporarily disabled for this token while security updates are applied";
  }
  return null;
};
