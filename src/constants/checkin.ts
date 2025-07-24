// Checkin-related constants

export const CHECKIN_CONFIG = {
  AUTO_SHOW_DELAY: 1500, // ms
  DROP_AMOUNT: 1000, // staked STREME
} as const;

export const CHECKIN_MESSAGES = {
  STAKED_USERS: [
    "Compound those Stremes.\nClaim 1000 staked $STREME.",
    "Time for your daily dose of dopastreme.\nClaim 1000 staked $STREME.",
    "It's Streme o'clock.\nClaim 1000 staked $STREME.",
    "You know the drill.\nClaim 1000 staked $STREME.",
  ],
  NEW_USER: "Claim 1000 staked $STREME to kick-start your streaming rewards",
  MODAL_TITLE: "Experimental Daily Staked Streme Drop",
} as const;

export const BUTTON_TEXT = {
  CLAIMING: "Claiming...",
  ALREADY_CLAIMED: "Already Claimed",
  CLAIM: "Claim",
} as const;