// THE ONLY SIGNER CONSTRUCTION IN THE REPO (plan U7 / Key Technical
// Decision: "First server-side signer").
//
// No other module may import this file except src/lib/resident/engine.ts —
// enforced by check:resident-isolation (scripts/check-resident-isolation.sh,
// wired into `npm run check:all`).
//
// Everything here is lazy and memoized: importing this module never touches
// RESIDENT_PRIVATE_KEY, so builds and dry-run code paths work without the
// secret. The key itself must never appear in any log or error message.

import {
  createWalletClient,
  fallback,
  http,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { base } from "viem/chains";

// Mirrors the fallback transport endpoints in src/lib/viemClient.ts (which
// exports a client, not its transport). Keep the two lists in sync.
const rpcEndpoints = [
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6",
  "https://mainnet.base.org",
  "https://developer-access-mainnet.base.org",
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!,
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
];

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

let cachedAccount: { key: string; account: PrivateKeyAccount } | null = null;
let cachedWalletClient: { key: string; client: WalletClient } | null = null;

/**
 * The Resident's viem account from RESIDENT_PRIVATE_KEY. Lazy + memoized;
 * throws when the env var is absent or malformed. Error messages never
 * include the key material.
 */
export function getResidentAccount(): PrivateKeyAccount {
  const key = process.env.RESIDENT_PRIVATE_KEY;
  if (!key) {
    throw new Error("RESIDENT_PRIVATE_KEY is not set");
  }
  if (!PRIVATE_KEY_RE.test(key)) {
    throw new Error(
      "RESIDENT_PRIVATE_KEY is malformed (expected 0x-prefixed 32-byte hex)"
    );
  }
  if (cachedAccount?.key !== key) {
    cachedAccount = {
      key,
      account: privateKeyToAccount(key as `0x${string}`),
    };
  }
  return cachedAccount.account;
}

/**
 * Wallet client over the same fallback transport family as the read-side
 * publicClient. Lazy + memoized per key.
 */
export function getResidentWalletClient(): WalletClient {
  const account = getResidentAccount();
  const key = process.env.RESIDENT_PRIVATE_KEY as string;
  if (cachedWalletClient?.key !== key) {
    cachedWalletClient = {
      key,
      client: createWalletClient({
        account,
        chain: base,
        transport: fallback(
          rpcEndpoints.map((url) =>
            http(url, { timeout: 10_000, retryCount: 2, retryDelay: 1000 })
          ),
          { rank: false }
        ),
      }),
    };
  }
  return cachedWalletClient.client;
}

/**
 * The Resident's derived address. The watcher keeps env RESIDENT_ADDRESS as
 * its own source of truth (it must work without the key in scope); this
 * export is for the engine.
 */
export function getResidentAddress(): `0x${string}` {
  return getResidentAccount().address;
}
