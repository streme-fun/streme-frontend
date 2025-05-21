import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync } from "node:fs";
import path from "node:path";

// Determine the correct path to .env.local
// Assumes the script is run from the project root or that .env.local is in the current working directory.
const envPath = path.resolve(process.cwd(), ".env.local");

if (!existsSync(envPath)) {
  console.error(`ERROR: .env.local file not found at ${envPath}`);
  console.error(
    "Please ensure the .env.local file exists in your project root or adjust the path in the script."
  );
  process.exit(1);
}

// Load environment variables from .env.local
dotenv.config({ path: envPath });

const privateKey = process.env.SERVER_SIGNER_PRIVATE_KEY;

if (!privateKey) {
  console.error(
    "ERROR: SERVER_SIGNER_PRIVATE_KEY not found in your .env.local file."
  );
  console.error("Please ensure it is set correctly.");
  process.exit(1);
}

if (!privateKey.startsWith("0x")) {
  console.error(
    'ERROR: SERVER_SIGNER_PRIVATE_KEY in .env.local does not start with "0x". It must be a 0x-prefixed hexadecimal string.'
  );
  process.exit(1);
}

try {
  const account = privateKeyToAccount(privateKey);
  console.log("Successfully loaded SERVER_SIGNER_PRIVATE_KEY from .env.local.");
  console.log("Derived Public Address:", account.address);
  console.log(
    "\nCompare this to the trustedSigner address in your smart contract."
  );
} catch (e) {
  console.error("Error deriving address from SERVER_SIGNER_PRIVATE_KEY:");
  console.error(e.message);
  console.log(
    "Ensure your SERVER_SIGNER_PRIVATE_KEY is a valid 0x-prefixed hexadecimal string."
  );
}
