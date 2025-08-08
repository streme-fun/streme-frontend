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
      console.log("Missing or invalid authorization header:", authHeader);
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    console.log("Received token for checkin:");
    console.log("- Token length:", token.length);
    console.log("- Token starts with:", token.substring(0, 20) + "...");
    console.log(
      "- Token format appears to be:",
      token.includes(".") ? "JWT-like" : "Simple string"
    );

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
    console.log("Making checkin request to:", externalApiUrl);

    const response = await fetch(externalApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Streme-Fun-App/1.0",
      },
    });

    console.log("External API response status:", response.status);

    // Get the response text first to avoid consuming the body multiple times
    const responseText = await response.text();

    if (!response.ok) {
      console.error("External API error details:");
      console.error("- Status:", response.status);
      console.error("- Status Text:", response.statusText);
      console.error("- Response body:", responseText);

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

      // Debug: Log the actual response structure
      console.log(
        "Raw checkin response:",
        JSON.stringify(checkinData, null, 2)
      );

      console.log("Checkin successful:", {
        fid: checkinData.fid,
        totalCheckins: checkinData.totalCheckins,
        currentStreak: checkinData.currentStreak,
        dropAmount: checkinData.dropAmount,
      });
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.error("Response text:", responseText);
      throw new Error("Invalid JSON response from external API");
    }

    return NextResponse.json(checkinData);
  } catch (error) {
    console.error("Checkin API route error:");
    console.error(
      "- Error message:",
      error instanceof Error ? error.message : "Unknown error"
    );
    console.error("- Full error object:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
