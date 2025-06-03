// PostHog Analytics Constants
// Following the rules: use enums for shared properties and consistent naming

export const POSTHOG_EVENTS = {
  STAKE_SUCCESS: "stake_success",
  STAKE_ALL_SUCCESS: "stake_all_success",
  TOP_UP_ALL_STAKES_SUCCESS: "top_up_all_stakes_success",
  UNSTAKE_SUCCESS: "unstake_success",
  SUP_CLAIM_SUCCESS: "sup_claim_success",
  SUP_LOCKER_CREATED: "sup_locker_created",
} as const;

export const ANALYTICS_PROPERTIES = {
  TOKEN_ADDRESS: "token_address",
  STAKING_ADDRESS: "staking_address",
  STAKING_POOL_ADDRESS: "staking_pool_address",
  TOKEN_SYMBOL: "token_symbol",
  AMOUNT_WEI: "amount_wei",
  AMOUNT_FORMATTED: "amount_formatted",
  USER_ADDRESS: "user_address",
  IS_MINI_APP: "is_mini_app",
  TRANSACTION_HASH: "transaction_hash",
  TOTAL_TOKENS_COUNT: "total_tokens_count",
  HAS_POOL_CONNECTION: "has_pool_connection",
  WALLET_TYPE: "wallet_type",
  SUP_POINTS_AMOUNT: "sup_points_amount",
  LOCKER_ADDRESS: "locker_address",
  CLAIM_PROGRAM_ID: "claim_program_id",
  CLAIM_NONCE: "claim_nonce",
} as const;

export type PostHogEvent = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];
export type AnalyticsProperty =
  (typeof ANALYTICS_PROPERTIES)[keyof typeof ANALYTICS_PROPERTIES];
