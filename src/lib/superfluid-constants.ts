/**
 * Shared Superfluid constants for the streme.fun application.
 * All Superfluid-related files should import from here to avoid duplication.
 */
import { Address } from "viem";

// STREME Super Token address on Base
export const STREME_SUPER_TOKEN = "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58" as Address;

// Time constants for flow rate calculations
export const SECONDS_PER_DAY = BigInt(86400);
export const SECONDS_PER_WEEK = BigInt(86400 * 7);
