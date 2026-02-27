// Snapshot vote utility for Streme Season 5 SUP rewards
// Replicates snapshot.js EIP-712 signing without any dependencies

const SNAPSHOT_SEQUENCER_URL = "https://seq.snapshot.org";

// EIP-712 domain (from snapshot.js source)
const SNAPSHOT_DOMAIN = {
  name: "snapshot",
  version: "0.1.4",
} as const;

// EIP-712 types for weighted vote (choice serialized as string)
const VOTE_STRING_TYPES = {
  Vote: [
    { name: "from", type: "address" },
    { name: "space", type: "string" },
    { name: "timestamp", type: "uint64" },
    { name: "proposal", type: "bytes32" },
    { name: "choice", type: "string" },
    { name: "reason", type: "string" },
    { name: "app", type: "string" },
    { name: "metadata", type: "string" },
  ],
} as const;

// Hardcoded vote parameters
const SPACE = "superfluid.eth";
const PROPOSAL =
  "0xf3480b2e05aff2d1328c6e36f22cb983fb50d6bb421703fe498beef106d38795";
const CHOICE = JSON.stringify({ "9": 1 });
const APP = "streme";

export interface VoteMessage {
  from: string;
  space: string;
  timestamp: number;
  proposal: string;
  choice: string;
  reason: string;
  app: string;
  metadata: string;
}

export interface VoteTypedData {
  domain: typeof SNAPSHOT_DOMAIN;
  types: typeof VOTE_STRING_TYPES;
  primaryType: "Vote";
  message: VoteMessage;
}

/**
 * Builds the EIP-712 typed data for this specific Snapshot vote.
 * Timestamp is generated fresh each call to avoid staleness rejections.
 */
export function buildVoteTypedData(address: string): VoteTypedData {
  return {
    domain: SNAPSHOT_DOMAIN,
    types: VOTE_STRING_TYPES,
    primaryType: "Vote",
    message: {
      from: address,
      space: SPACE,
      timestamp: Math.floor(Date.now() / 1000),
      proposal: PROPOSAL,
      choice: CHOICE,
      reason: "",
      app: APP,
      metadata: "{}",
    },
  };
}

/**
 * Submits a signed vote to the Snapshot sequencer.
 */
export async function submitVote(
  address: string,
  signature: string,
  typedData: VoteTypedData
): Promise<{ id: string }> {
  const response = await fetch(SNAPSHOT_SEQUENCER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      sig: signature,
      data: {
        domain: typedData.domain,
        types: typedData.types,
        message: typedData.message,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Snapshot vote failed: ${errorBody}`);
  }

  return response.json();
}
