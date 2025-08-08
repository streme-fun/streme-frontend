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
      console.log("Missing or invalid authorization header:", authHeader);
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    console.log("Received token for API call:");
    console.log("- Token length:", token.length);
    console.log("- Token starts with:", token.substring(0, 20) + "...");
    console.log(
      "- Token format appears to be:",
      token.includes(".") ? "JWT-like" : "Simple string"
    );

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
    console.log("Making request to:", externalApiUrl);

    const response = await fetch(externalApiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Streme-Fun-App/1.0",
      },
    });

    console.log("External API response status:", response.status);
    console.log(
      "External API response headers:",
      Object.fromEntries(response.headers.entries())
    );

    // Get the response text first to avoid consuming the body multiple times
    const responseText = await response.text();

    if (!response.ok) {
      console.error("External API error details:");
      console.error("- Status:", response.status);
      console.error("- Status Text:", response.statusText);
      console.error("- Response body:", responseText);

      return NextResponse.json(
        {
          error: `External API error: ${response.status} ${response.statusText}`,
          details: responseText,
          apiUrl: externalApiUrl,
        },
        { status: response.status }
      );
    }

    // Parse the JSON response
    let externalData: ExternalApiResponse;
    try {
      externalData = JSON.parse(responseText);

      // Debug: Log the actual response structure
      console.log(
        "Raw response structure:",
        JSON.stringify(externalData, null, 2)
      );
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.error("Response text:", responseText);
      throw new Error("Invalid JSON response from external API");
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

    console.log("Successfully fetched and mapped user data:");
    console.log("- FID:", userData.fid);
    console.log("- Wallet:", userData.wallet);
    console.log("- Points earned:", userData.points.totalEarned);
    console.log("- In Stack:", externalData.inStack);
    console.log("- Has signature:", !!externalData.signature);
    console.log("- FluidLocker address:", userData.fluidLocker.address);
    console.log("- FluidLocker created:", userData.fluidLocker.isCreated);

    return NextResponse.json(userData);
  } catch (error) {
    console.error("API route error - detailed information:");
    console.error(
      "- Error message:",
      error instanceof Error ? error.message : "Unknown error"
    );
    console.error(
      "- Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    console.error("- Error type:", typeof error);
    console.error("- Full error object:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
