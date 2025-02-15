import {
  fetchTokenFromStreme,
  fetchCreatorProfiles,
  enrichTokensWithData,
} from "@/app/lib/apiUtils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      console.error("Address is required");
      return Response.json({ error: "Address is required" }, { status: 400 });
    }

    // Fetch single token directly
    const token = await fetchTokenFromStreme(address);

    if (!token) {
      console.error("Token not found:", address);
      return Response.json({ error: "Token not found" }, { status: 404 });
    }

    // Get creator profile if exists
    const creatorProfiles = token.requestor_fid
      ? await fetchCreatorProfiles([token.requestor_fid.toString()])
      : {};

    // Enrich token with data
    const enrichedToken = await enrichTokensWithData(
      [token],
      creatorProfiles,
      true
    );

    return Response.json({ data: enrichedToken[0] });
  } catch (error) {
    console.error("Error fetching token:", error);
    return Response.json({ error: "Failed to fetch token" }, { status: 500 });
  }
}
