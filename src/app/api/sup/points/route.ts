import { NextRequest, NextResponse } from "next/server";
import { createClient, Errors } from "@farcaster/quick-auth";

interface ExternalApiResponse {
  amount: number;
  inStack: boolean;
  fid: number;
  wallet: string;
  locker: string;
  lockerCreated: boolean;
  signature?: string;
  signatureTimestamp?: number;
}

interface UserPointsData {
  fid: number;
  wallet: string;
  points: {
    totalEarned: number;
    currentRate: number;
    stackSignedData?: string;
    signatureTimestamp?: number;
  };
  fluidLocker: {
    address: string | null;
    isCreated: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Extract the authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify Quick Auth JWT per Farcaster docs
    let fid = 0;
    try {
      const client = createClient();
      const payload = await client.verifyJwt({
        token,
        domain: request.headers.get("host") || "streme.fun",
      });
      const sub = Number(payload.sub);
      if (!Number.isFinite(sub)) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      fid = sub;
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw e;
    }

    // Make the request to the external API
    const externalApiUrl = "https://api.streme.fun/api/sup/points";

    const response = await fetch(externalApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Streme-Fun-App/1.0",
      },
    });

    // Get the response text first to avoid consuming the body multiple times
    const responseText = await response.text();

    if (!response.ok) {
      console.error("SUP points API error:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch points data" },
        { status: response.status }
      );
    }

    // Parse the JSON response
    let externalData: ExternalApiResponse;
    try {
      externalData = JSON.parse(responseText);
    } catch {
      console.error("SUP points API: Invalid JSON response");
      return NextResponse.json(
        { error: "Invalid response from points service" },
        { status: 502 }
      );
    }

    // Map external response to expected format
    const userData: UserPointsData = {
      fid: externalData.fid || fid, // Use FID from response, fallback to JWT
      wallet: externalData.wallet,
      points: {
        totalEarned: externalData.amount,
        currentRate: 0, // Not provided by external API
        stackSignedData: externalData.signature,
        signatureTimestamp: externalData.signatureTimestamp,
      },
      fluidLocker: {
        address:
          externalData.locker === "0x0000000000000000000000000000000000000000"
            ? null
            : externalData.locker,
        isCreated: externalData.lockerCreated,
      },
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error(
      "SUP points API error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
