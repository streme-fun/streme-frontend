import {
  createAppClient,
  viemConnector,
} from "@farcaster/auth-client";
// JWT secret - in production, use a proper secret from environment
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "streme-auth-secret-change-in-production";

// Create a Farcaster auth client for signature verification (lazy initialized)
let _appClient: ReturnType<typeof createAppClient> | null = null;

export function getAppClient() {
  if (!_appClient) {
    _appClient = createAppClient({
      ethereum: viemConnector({
        rpcUrl: "https://mainnet.base.org",
      }),
    });
  }
  return _appClient;
}

// For testing: allow injection of a mock client
export function _setAppClientForTesting(client: ReturnType<typeof createAppClient> | null) {
  _appClient = client;
}

// WebCrypto-compatible base64url encoding/decoding
function toBase64Url(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

async function getHmacKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacSign(data: string): Promise<string> {
  const key = await getHmacKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a secure session token using HMAC-SHA256 signing (WebCrypto)
 */
export async function generateSecureSessionToken(fid: number, address: string): Promise<string> {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    fid,
    address: address.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));

  const signature = await hmacSign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a session token and return the payload if valid (WebCrypto)
 * This can be used by other API routes to validate authentication
 */
export async function verifySessionToken(token: string): Promise<{ fid: number; address: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, providedSignature] = parts;

    // Verify signature
    const expectedSignature = await hmacSign(`${encodedHeader}.${encodedPayload}`);

    if (providedSignature !== expectedSignature) {
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(fromBase64Url(encodedPayload));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      fid: payload.fid,
      address: payload.address,
    };
  } catch {
    return null;
  }
}
