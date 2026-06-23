// Snapshot vote configuration
// Toggle `enabled` and update parameters each season

export const SNAPSHOT_CONFIG = {
  /** Set to true to show the vote banner in the mini app */
  enabled: false,

  /** Snapshot space (e.g. "superfluid.eth") */
  space: "superfluid.eth",

  /** Proposal hash for the current season */
  proposal:
    "0x9ec837de9a1093007e7ba2996502c922060f0b6bc368b3c877c7bbc1724204a8",

  /** Weighted vote choice — key is option index, value is weight (1 = 100%) */
  choice: { "8": 1 } as Record<string, number>,

  /** App identifier sent to Snapshot */
  app: "streme",

  /** localStorage key prefix — bump per season to reset dismiss/voted state */
  storagePrefix: "streme-vote-s6",
} as const;
