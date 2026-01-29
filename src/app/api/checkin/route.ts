import { NextRequest, NextResponse } from "next/server";
import { createClient, Errors } from "@farcaster/quick-auth";

interface CheckinResponse {
  success: boolean;
  fid: number;
  wallet: string;
  checkinDate: string;
  totalCheckins: number;
  currentStreak: number;
  dropAmount: string;
  dropTxHash?: string;
  error?: string;
}

interface CheckinStatusResponse {
  fid: number;
  checkedInToday: boolean;
  lastCheckinDate?: string;
  totalCheckins: number;
  currentStreak: number;
  dropHistory: Array<{
    date: string;
    amount: string;
    txHash?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    // Extract bearer token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify Quick Auth JWT per Farcaster docs
    try {
      const client = createClient();
      await client.verifyJwt({
        token,
        domain: request.headers.get("host") || "streme.fun",
      });
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw e;
    }

    // Forward the request to the external API
    const response = await fetch("https://api.streme.fun/api/checkin", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Checkin status API error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch checkin status" },
        { status: response.status }
      );
    }

    const data: CheckinStatusResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in checkin GET route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    try {
      const client = createClient();
      await client.verifyJwt({
        token,
        domain: request.headers.get("host") || "streme.fun",
      });
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw e;
    }

    // Make the request to the external API
    const externalApiUrl = "https://api.streme.fun/api/checkin";

    const response = await fetch(externalApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Streme-Fun-App/1.0",
      },
    });

    // Get the response text first to avoid consuming the body multiple times
    const responseText = await response.text();

    if (!response.ok) {
      console.error("Checkin API error:", response.status);

      // Parse error response if possible
      let errorMessage = `External API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If parsing fails, use the raw response text
        errorMessage = responseText || errorMessage;
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: response.status }
      );
    }

    // Parse the JSON response
    let checkinData: CheckinResponse;
    try {
      checkinData = JSON.parse(responseText);
    } catch {
      console.error("Checkin API: Invalid JSON response");
      throw new Error("Invalid JSON response from external API");
    }

    return NextResponse.json(checkinData);
  } catch (error) {
    console.error(
      "Checkin API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
