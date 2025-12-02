export const LP_FACTORY_ADDRESS = "0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8";
export const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";
export const FEE_STREAMER_ADDRESS =
  "0x5568e654ffdca8e1Cf46b91D438980a83D4ebb10";

// V1 Addresses
export const STREME_DEPLOY_ADDRESS =
  "0xd00A1ca0e0720206F489Cd0aad434Af59F4Bb16B";
export const TOKEN_FACTORY_ADDRESS =
  "0xcd26DE432EBF832c654176A807b495d966a3E69C";
export const POST_DEPLOY_HOOK_ADDRESS =
  "0x293A5d47f5D76244b715ce0D0e759E0227349486";
export const MAIN_STREME_ADDRESS = "0x5797a398fe34260f81be65908da364cc18fbc360";

// V2 Addresses
export const STREME_PUBLIC_DEPLOYER_V2 =
  "0x8712F62B3A2EeBA956508e17335368272f162748";
export const STREME_SUPER_TOKEN_FACTORY =
  "0xB973FDd29c99da91CAb7152EF2e82090507A1ce9";
export const STREME_ALLOCATION_HOOK =
  "0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B";
export const STREME_STAKING_FACTORY_V2 =
  "0xC749105bc4b4eA6285dBBe2E8221c922BEA07A9d";
export const STREME_VAULT = "0xDa902C1F73160daDE69AB3c3355110442359EB70";

// V2Aero Addresses
export const FEE_COLLECTOR_LETS =
  "0x7CF7a05fE8f172dfeDBe2d3A36C2B899233d02c0";
export const FEE_COLLECTOR =
  "0x8017FE8bD5b894145085412fc3d1005A74E1EC4b";
export const ZAP_CONTRACT_ADDRESS =
  "0x47217096d8fe0FfECCCf2701e9c450658A93b59a";

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

// V2 Deployment ABI
export const STREME_DEPLOY_V2_ABI = [
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
      {
        name: "allocationConfigs",
        type: "tuple[]",
        components: [
          { name: "allocationType", type: "uint8" },
          { name: "admin", type: "address" },
          { name: "percentage", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    name: "deployWithAllocations",
    outputs: [
      { name: "token", type: "address" },
      { name: "liquidityId", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// Vault ABI
export const STREME_VAULT_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "admin", type: "address" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "admin", type: "address" },
      { name: "member", type: "address" },
      { name: "newUnits", type: "uint128" },
    ],
    name: "updateMemberUnits",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "admin", type: "address" },
      { name: "members", type: "address[]" },
      { name: "newUnits", type: "uint128[]" },
    ],
    name: "updateMemberUnitsBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "admin", type: "address" },
      { name: "member", type: "address" },
    ],
    name: "getUnits",
    outputs: [{ name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "admin", type: "address" },
    ],
    name: "allocation",
    outputs: [
      { name: "tokenAddress", type: "address" },
      { name: "amountTotal", type: "uint256" },
      { name: "amountClaimed", type: "uint256" },
      { name: "lockupEndTime", type: "uint256" },
      { name: "vestingEndTime", type: "uint256" },
      { name: "allocationAdmin", type: "address" },
      { name: "pool", type: "address" },
      { name: "box", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
