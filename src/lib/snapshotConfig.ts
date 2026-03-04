// Snapshot vote configuration
// Toggle `enabled` and update parameters each season

export const SNAPSHOT_CONFIG = {
  /** Set to true to show the vote banner in the mini app */
  enabled: false,

  /** Snapshot space (e.g. "superfluid.eth") */
  space: "superfluid.eth",

  /** Proposal hash for the current season */
  proposal:
    "0xf3480b2e05aff2d1328c6e36f22cb983fb50d6bb421703fe498beef106d38795",

  /** Weighted vote choice — key is option index, value is weight (1 = 100%) */
  choice: { "9": 1 } as Record<string, number>,

  /** App identifier sent to Snapshot */
  app: "streme",

  /** localStorage key prefix — bump per season to reset dismiss/voted state */
  storagePrefix: "streme-vote-s5",
} as const;
