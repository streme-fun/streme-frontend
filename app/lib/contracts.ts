export const LP_FACTORY_ADDRESS = "0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8";
export const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";

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
