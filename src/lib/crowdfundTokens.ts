// Crowdfund token configuration
// Add new tokens here to enable their crowdfund pages

export interface CrowdfundToken {
  address: string;
  symbol: string;
  name: string;
  slug: string; // URL-friendly identifier
  description?: string;
  endDate?: string; // Optional end date for the crowdfund

  // UI customization
  fundTitle?: string; // e.g. "Streme Growth Fund"
  fundDescription?: string; // Main description text
  fundPurpose?: string; // e.g. "pooled for growth initiatives"
  howItWorks?: string; // Explanation text
  rewardToken?: string; // e.g. "SUP"
  rewardDescription?: string; // What rewards users get
  videoUrl?: string; // Optional video to display instead of animation (with fallback)

  // Contract addresses
  depositContractAddress?: string; // Where funds are pooled
  gdaForwarderAddress?: string; // For flow rate calculations
}

export const CROWDFUND_TOKENS: CrowdfundToken[] = [
  {
    address: "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58",
    symbol: "STREME",
    name: "Streme",
    slug: "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58",
    description: "The official Streme platform token",

    // UI customization
    fundTitle: "Streme Growth Fund",
    fundDescription:
      "Help Streme grow through marketing and dev initiatives. Deposit your staked $STREME to earn SUP rewards.",
    fundPurpose: "pooled for growth initiatives",
    howItWorks:
      "When you stake STREME tokens, they generate yield aka rewards. By staking your STREME in the crowdfund contract, you temporarily redirect that yield to the Growth Fund. There are no locks and you can withdraw your staked STREME anytime.",
    rewardToken: "SUP",
    rewardDescription:
      "$SUP is the Superfluid token. Fund contributors earn increases in SUP flow rate based on their contribution size. Be sure to claim daily to update your flow rate.",

    // Contract addresses
    depositContractAddress: "0xceaCfbB5A17b6914051D12D8c91d3461382d503b",
    gdaForwarderAddress: "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08",
  },
  {
    address: "0x1c4f69f14cf754333c302246d25a48a13224118a",
    symbol: "$BUTTHOLE",
    name: "BUTTHOLE",
    slug: "0x1c4f69f14cf754333c302246d25a48a13224118a",
    description: "Community meme token",

    // UI customization
    fundTitle: "Butthole Flush Fund",
    fundDescription:
      "Send your BUTTHOLE yield straight to the Flush Fund, ensuring maximum dumpage on each week's PoS.",
    fundPurpose: "pooled for community initiatives",
    howItWorks:
      "Stake your BUTTHOLE tokens to redirect yield to the community fund. No locks - withdraw anytime while supporting the community.",
    rewardToken: "SUP",
    rewardDescription:
      "Contributors earn SUP token rewards based on their contribution.",
    videoUrl: "https://vimeo.com/1112445012?share=copy",

    // Contract addresses - Using same contracts for now
    depositContractAddress: "0x003eAb4972C6056ab698B2A2fc6dB3DdD057daaB",
    gdaForwarderAddress: "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08",
  },
];

// Legacy array for backward compatibility
export const CROWDFUND_TOKEN_ADDRESSES = CROWDFUND_TOKENS.map((t) => t.address);

// Helper function to check if a token is a crowdfund token
export const isCrowdfundToken = (contractAddress: string): boolean => {
  return CROWDFUND_TOKEN_ADDRESSES.includes(contractAddress.toLowerCase());
};

// Get crowdfund token by address
export const getCrowdfundTokenByAddress = (
  address: string
): CrowdfundToken | undefined => {
  return CROWDFUND_TOKENS.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
};

// Get crowdfund token by slug (for URL routing)
export const getCrowdfundTokenBySlug = (
  slug: string
): CrowdfundToken | undefined => {
  return CROWDFUND_TOKENS.find(
    (t) => t.slug.toLowerCase() === slug.toLowerCase()
  );
};
