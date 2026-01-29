import { NextRequest, NextResponse } from "next/server";
import {
  createAppClient,
  viemConnector,
} from "@farcaster/auth-client";
import { createHmac } from "crypto";

interface SIWFVerificationRequest {
  message: string;
  signature: string;
  nonce: string;
}

// JWT secret - in production, use a proper secret from environment
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "streme-auth-secret-change-in-production";

// Create a Farcaster auth client for signature verification (lazy initialized)
let _appClient: ReturnType<typeof createAppClient> | null = null;

function getAppClient() {
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

export async function POST(request: NextRequest) {
  try {
    const body: SIWFVerificationRequest = await request.json();
    const { message, signature, nonce } = body;

    if (!message || !signature || !nonce) {
      return NextResponse.json(
        { error: "Missing required fields: message, signature, and nonce" },
        { status: 400 }
      );
    }

    // Determine domain from request headers
    const host = request.headers.get("host") || "localhost:3000";
    const origin = request.headers.get("origin");
    let domain = "localhost:3000";

    if (process.env.NODE_ENV === "production") {
      domain = "streme.fun";
    } else if (origin) {
      try {
        const url = new URL(origin);
        domain = url.host;
      } catch {
        domain = host;
      }
    } else {
      domain = host;
    }

    console.log("SIWF verification using domain:", domain);

    try {
      // Use @farcaster/auth-client to properly verify the signature
      const appClient = getAppClient();
      const verifyResult = await appClient.verifySignInMessage({
        message,
        signature: signature as `0x${string}`,
        nonce,
        domain,
        acceptAuthAddress: true, // Accept both custody and auth addresses
      });

      if (verifyResult.isError || !verifyResult.fid) {
        console.error("SIWF verification failed:", verifyResult.error);
        return NextResponse.json(
          { error: "Signature verification failed" },
          { status: 401 }
        );
      }

      const fid = verifyResult.fid;
      // Extract address from the verified SIWE message
      const address = verifyResult.data?.address;

      if (!address) {
        return NextResponse.json(
          { error: "Could not extract address from verified message" },
          { status: 401 }
        );
      }

      // Generate a properly signed JWT token
      const sessionToken = generateSecureSessionToken(fid, address);

      return NextResponse.json({
        token: sessionToken,
        user: {
          fid,
          address,
        },
      });
    } catch (verificationError) {
      console.error("SIWF verification error:", verificationError);
      return NextResponse.json(
        { error: "Message verification failed" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error in /api/auth/verify-siwf:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generate a secure session token using HMAC-SHA256 signing
 */
function generateSecureSessionToken(fid: number, address: string): string {
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
