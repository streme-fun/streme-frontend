// Checkin-related constants

export const CHECKIN_CONFIG = {
  AUTO_SHOW_DELAY: 1500, // ms
  DROP_AMOUNT: 1000, // staked STREME
} as const;

export const CHECKIN_MESSAGES = {
  STAKED_USERS_WITH_BALANCE: [
    "Time for your daily dose of dopastreme.\nStake to claim 1000 staked $STREME.",
    "It's Streme o'clock.\nStake to claim 1000 staked $STREME.",
    "You know the drill.\nStake to claim 1000 staked $STREME.",
    "Must make number go up faster.\nStake to claim 1000 staked $STREME.",
  ],
  STAKED_USERS_NO_BALANCE: [
    "Time for your daily dose of dopastreme.\nClaim 1000 staked $STREME.",
    "It's Streme o'clock.\nClaim 1000 staked $STREME.",
    "You know the drill.\nClaim 1000 staked $STREME.",
    "Must make number go up faster.\nClaim 1000 staked $STREME.",
  ],
  NEED_TO_STAKE:
    "Stake your $STREME to auto-claim 1000 staked $STREME.\nStaking triggers instant reward claim.",
  NEW_USER:
    "Welcome! Claim 1000 staked $STREME to get started with streaming rewards.",
  MODAL_TITLE: "Experimental Daily Staked Streme Drop",
} as const;

export const BUTTON_TEXT = {
  CLAIMING: "Claiming...",
  ALREADY_CLAIMED: "Already Claimed",
  CLAIM: "Claim",
  STAKE: "Stake & Claim",
} as const;
