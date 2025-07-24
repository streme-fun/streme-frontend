import { Address } from "viem";

// Superfluid Core Contract Addresses on Base Mainnet
export const SUPERFLUID_BASE_CONTRACTS = {
  // Core protocol addresses (verified from Superfluid metadata)
  HOST: "0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74" as Address, // Superfluid Host on Base Mainnet
  CFA_V1: "0x19ba78B9cDB05A877718841c574325fdB53601bb" as Address, // CFAv1 on Base Mainnet
  CFA_V1_FORWARDER: "0xcfA132E353cB4E398080B9700609bb008eceB125" as Address, // CFA Forwarder on Base Mainnet
  GDA_V1_FORWARDER: "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08" as Address, // Standard across all networks

  // FluidLocker related contracts (user provided)
  FLUID_LOCKER_FACTORY: "0xa6694cab43713287f7735dadc940b555db9d39d9" as Address, // FluidLockerFactory address provided by user
} as const;

// Export individual contract addresses for easier importing
export const HOST = SUPERFLUID_BASE_CONTRACTS.HOST;
export const CFA_V1 = SUPERFLUID_BASE_CONTRACTS.CFA_V1;
export const CFA_V1_FORWARDER = SUPERFLUID_BASE_CONTRACTS.CFA_V1_FORWARDER;
export const GDA_V1_FORWARDER = SUPERFLUID_BASE_CONTRACTS.GDA_V1_FORWARDER;

// FluidLockerFactory ABI for creating and checking lockers
export const FLUID_LOCKER_FACTORY_ABI = [
  {
    inputs: [],
    name: "createLockerContract",
    outputs: [{ name: "lockerInstance", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "createLockerContract",
    outputs: [{ name: "lockerInstance", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserLocker",
    outputs: [
      { name: "isCreated", type: "bool" },
      { name: "lockerAddress", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getLockerAddress",
    outputs: [{ name: "lockerAddress", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// FluidLocker ABI for claiming rewards
export const FLUID_LOCKER_ABI = [
  {
    inputs: [
      { name: "programId", type: "uint256" },
      { name: "totalProgramUnits", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "stackSignature", type: "bytes" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
