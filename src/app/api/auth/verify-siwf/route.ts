import { NextRequest, NextResponse } from "next/server";
import { getAppClient, generateSecureSessionToken } from "@/src/lib/siwf-auth";

interface SIWFVerificationRequest {
  message: string;
  signature: string;
  nonce: string;
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
        console.error("SIWF verification failed:", verifyResult.isError ? "error" : "no fid");
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
      console.error(
        "SIWF verification error:",
        verificationError instanceof Error ? verificationError.message : "Unknown error"
      );
      return NextResponse.json(
        { error: "Message verification failed" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error(
      "Error in /api/auth/verify-siwf:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
