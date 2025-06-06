import { NextRequest, NextResponse } from "next/server";

interface EligibilityData {
  pointSystemId: number;
  pointSystemName: string;
  eligible: boolean;
  points: number;
  claimedAmount: number;
  needToClaim: boolean;
  gdaPoolAddress: string;
  estimatedFlowRate: string;
}

interface SupEligibilityResult {
  address: string;
  hasAllocations: boolean;
  claimNeeded: boolean;
  totalFlowRate: string;
  eligibility: EligibilityData[];
}

interface SupEligibilityResponse {
  results: SupEligibilityResult[];
}

export async function GET(request: NextRequest) {
  console.log("SUP Eligibility API: Route hit");

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    console.log("SUP Eligibility API: Address parameter:", address);

    if (!address) {
      console.log("SUP Eligibility API: No address provided");
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SUPERFLUID_API_KEY;
    console.log("SUP Eligibility API: API key exists:", !!apiKey);

    if (!apiKey) {
      console.error(
        "SUP Eligibility API: SUPERFLUID_API_KEY is not configured"
      );
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    const eligibilityUrl = `https://sup-eligibility-api.s.superfluid.dev/eligibility?addresses=${address}`;
    console.log("SUP Eligibility API: Making request to:", eligibilityUrl);

    const response = await fetch(eligibilityUrl, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    console.log(
      "SUP Eligibility API: Superfluid response status:",
      response.status
    );

    if (!response.ok) {
      console.error(
        `SUP Eligibility API: Superfluid API error: ${response.status} ${response.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to fetch eligibility data" },
        { status: response.status }
      );
    }

    const data: SupEligibilityResponse = await response.json();
    console.log(
      "SUP Eligibility API: Received data:",
      JSON.stringify(data, null, 2)
    );

    // Find the result for the requested address
    const userResult = data.results.find(
      (result) => result.address.toLowerCase() === address.toLowerCase()
    );

    if (!userResult) {
      console.log("SUP Eligibility API: No result found for address:", address);
      return NextResponse.json(
        { error: "No eligibility data found for address" },
        { status: 404 }
      );
    }

    console.log("SUP Eligibility API: Returning user result:", userResult);
    return NextResponse.json(userResult);
  } catch (error) {
    console.error(
      "SUP Eligibility API: Error fetching SUP eligibility:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
