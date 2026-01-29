import {
  createAppClient,
  viemConnector,
} from "@farcaster/auth-client";
import { createHmac } from "crypto";

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

/**
 * Generate a secure session token using HMAC-SHA256 signing
 */
export function generateSecureSessionToken(fid: number, address: string): string {
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

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a session token and return the payload if valid
 * This can be used by other API routes to validate authentication
 */
export function verifySessionToken(token: string): { fid: number; address: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, providedSignature] = parts;

    // Verify signature
    const expectedSignature = createHmac("sha256", JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    if (providedSignature !== expectedSignature) {
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());

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
