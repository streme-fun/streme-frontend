import { NextResponse } from "next/server";
import { init, fetchQuery } from "@airstack/node";
// import { getCachedData, setCachedData } from "@/utils/caching";

// Initialize Airstack API
const apiKey = process.env.AIRSTACK_API_KEY;
if (!apiKey) {
  throw new Error("AIRSTACK_API_KEY is not defined");
}
init(apiKey);

const getProfileImagesQuery = `
query GetProfilePicturesAndUsernames($userId: [String!]!) {
  Socials(
    input: {filter: {userId: {_in: $userId}}, blockchain: ethereum}
  ) {
    Social {
      dappName
      profileName
      profileImage
      userId
    }
  }
}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userIds = searchParams.get("userIds");

  if (!userIds) {
    return NextResponse.json(
      { error: "userIds parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Pass userIds directly in the variables object
    const response = await fetchQuery(getProfileImagesQuery, {
      userId: userIds.split(","),
    });

    console.log("Response data:", response.data);
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Error fetching profile images:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile images" },
      { status: 500 }
    );
  }
}
