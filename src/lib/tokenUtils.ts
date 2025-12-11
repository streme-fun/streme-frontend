/**
 * Token utility functions for staking operations
 */

/**
 * Manually blocked token addresses (lowercase)
 * These tokens have staking disabled regardless of their type
 */
const MANUALLY_BLOCKED_ADDRESSES = [
  "0x2800f7bbdd38e84f38ef0a556705a62b5104e91b",
  "0x3ea91263dc6037ced4db9ff74a7de774df0f5355",
];

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

  // Check token type
  if (!tokenType) return false; // Allow if undefined (backwards compatibility)
  const normalized = tokenType.toLowerCase();
  return normalized === "v2" || normalized === "v2aero";
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
  if (isStakingDisabled(tokenType, tokenAddress)) {
    return "Staking temporarily disabled for this token type while security updates are applied";
  }
  return null;
};
