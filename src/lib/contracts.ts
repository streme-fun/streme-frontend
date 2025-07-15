export const LP_FACTORY_ADDRESS = "0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8";
export const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";
export const STREME_DEPLOY_ADDRESS = "0xd00A1ca0e0720206F489Cd0aad434Af59F4Bb16B";

// Addresses from successful transaction
export const TOKEN_FACTORY_ADDRESS = "0xcd26DE432EBF832c654176A807b495d966a3E69C";
export const POST_DEPLOY_HOOK_ADDRESS = "0x293A5d47f5D76244b715ce0D0e759E0227349486";
export const MAIN_STREME_ADDRESS = "0x5797a398fe34260f81be65908da364cc18fbc360";

export const LP_FACTORY_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "getTokensDeployedByUser",
    outputs: [
      {
        components: [
          { name: "token", type: "address" },
          { name: "locker", type: "address" },
          { name: "positionId", type: "uint256" },
        ],
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "claimRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const GDA_ABI = [
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "member", type: "address" },
    ],
    name: "isMemberConnected",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "userData", type: "bytes" },
    ],
    name: "connectPool",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const STREME_DEPLOY_ABI = [
  {
    inputs: [
      { name: "_symbol", type: "string" },
      { name: "_requestor", type: "address" },
      { name: "_tokenFactory", type: "address" },
      { name: "_pairedToken", type: "address" },
    ],
    name: "generateSalt",
    outputs: [
      { name: "salt", type: "bytes32" },
      { name: "token", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenFactory", type: "address" },
      { name: "postDeployHook", type: "address" },
      { name: "liquidityFactory", type: "address" },
      { name: "postLPHook", type: "address" },
      {
        name: "preSaleTokenConfig",
        type: "tuple",
        components: [
          { name: "_name", type: "string" },
          { name: "_symbol", type: "string" },
          { name: "_supply", type: "uint256" },
          { name: "_fee", type: "uint24" },
          { name: "_salt", type: "bytes32" },
          { name: "_deployer", type: "address" },
          { name: "_fid", type: "uint256" },
          { name: "_image", type: "string" },
          { name: "_castHash", type: "string" },
          {
            name: "_poolConfig",
            type: "tuple",
            components: [
              { name: "tick", type: "int24" },
              { name: "pairedToken", type: "address" },
              { name: "devBuyFee", type: "uint24" },
            ],
          },
        ],
      },
    ],
    name: "deploy",
    outputs: [
      { name: "token", type: "address" },
      { name: "liquidityId", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;
