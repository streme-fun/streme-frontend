import { NextRequest, NextResponse } from "next/server";

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

    // Determine domain from request headers or use default
    const host = request.headers.get("host") || "localhost:3000";
    const origin = request.headers.get("origin");
    let domain = "localhost:3000";

    if (process.env.NODE_ENV === "production") {
      domain = "streme.fun";
    } else if (origin) {
      // Extract domain from origin for tunnel URLs
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
      // Simple message parsing to extract FID and address
      // In production, use proper @farcaster/auth-kit verification
      const fidMatch = message.match(/fid:(\d+)/);
      const addressMatch = message.match(/(0x[a-fA-F0-9]{40})/);

      if (!fidMatch || !addressMatch) {
        return NextResponse.json(
          { error: "Invalid SIWF message format" },
          { status: 401 }
        );
      }

      const fid = parseInt(fidMatch[1]);
      const address = addressMatch[1];

      // Generate a session token for authentication
      const sessionToken = generateSessionToken(fid, address);

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

// Generate a simple session token (in production, use proper JWT)
function generateSessionToken(fid: number, address: string): string {
  const payload = {
    fid,
    address,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };

  // Simple base64 encoding (NOT secure for production)
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
