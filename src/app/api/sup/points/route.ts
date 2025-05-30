import { NextRequest, NextResponse } from "next/server";

interface UserPointsData {
  fid: number;
  address: string;
  points: {
    totalEarned: number;
    currentRate: number;
    stackSignedData?: string;
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
    let userData: UserPointsData;
    try {
      userData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      console.error("Response text:", responseText);
      throw new Error("Invalid JSON response from external API");
    }

    console.log("Successfully fetched user data:");
    console.log("- FID:", userData.fid);
    console.log("- Address:", userData.address);
    console.log("- Points earned:", userData.points.totalEarned);

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
