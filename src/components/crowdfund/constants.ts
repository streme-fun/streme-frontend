export const DEFAULT_TOKEN_ADDRESS = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58";
export const DEFAULT_DEPOSIT_CONTRACT = "0xceaCfbB5A17b6914051D12D8c91d3461382d503b";

export const STAKING_ABI = [
  {
    name: "depositTimestamps",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;