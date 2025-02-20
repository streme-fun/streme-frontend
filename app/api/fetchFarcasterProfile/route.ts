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
    const userIdArray = userIds.split(",");

    // Ensure we don't exceed Airstack's limit
    if (userIdArray.length > 50) {
      console.warn(`Received ${userIdArray.length} userIds, limiting to 50`);
      userIdArray.length = 50;
    }

    const response = await fetchQuery(getProfileImagesQuery, {
      userId: userIdArray,
    });

    console.log(
      `Fetched ${response.data?.Socials?.Social?.length ?? 0} profiles for ${
        userIdArray.length
      } requested IDs`
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Error fetching profile images:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile images" },
      { status: 500 }
    );
  }
}
