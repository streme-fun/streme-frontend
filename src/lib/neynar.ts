import {
  NeynarAPIClient,
  Configuration,
  WebhookUserCreated,
} from "@neynar/nodejs-sdk";
import { APP_URL } from "./constants";

let neynarClient: NeynarAPIClient | null = null;

// Example usage:
// const client = getNeynarClient();
// const user = await client.lookupUserByFid(fid);
export function getNeynarClient() {
  if (!neynarClient) {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      throw new Error("NEYNAR_API_KEY not configured");
    }
    const config = new Configuration({ apiKey });
    neynarClient = new NeynarAPIClient(config);
  }
  return neynarClient;
}

export type User = WebhookUserCreated["data"];

export async function getNeynarUser(fid: number): Promise<User | null> {
  try {
    const client = getNeynarClient();
    const usersResponse = await client.fetchBulkUsers({ fids: [fid] });
    return usersResponse.users[0];
  } catch (error) {
    console.error("Error getting Neynar user:", error);
    return null;
  }
}

type SendFrameNotificationResult =
  | {
      state: "error";
      error: unknown;
    }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "success" };

export async function sendNeynarFrameNotification({
  fid,
  title,
  body,
}: {
  fid: number;
  title: string;
  body: string;
}): Promise<SendFrameNotificationResult> {
  try {
    const client = getNeynarClient();
    const targetFids = [fid];
    const notification = {
      title,
      body,
      target_url: APP_URL,
    };

    const result = await client.publishFrameNotifications({
      targetFids,
      notification,
    });

    if (result.notification_deliveries.length > 0) {
      return { state: "success" };
    } else if (result.notification_deliveries.length === 0) {
      return { state: "no_token" };
    } else {
      return { state: "error", error: result || "Unknown error" };
    }
  } catch (error) {
    return { state: "error", error };
  }
}

export interface BestFriend {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  mutual_affinity_score: number;
  custody_address: string;
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
}

export async function getBestFriends(fid: number, limit: number = 10): Promise<BestFriend[]> {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      throw new Error("NEYNAR_API_KEY not configured");
    }

    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/best_friends?fid=${fid}&limit=${limit}`,
      {
        headers: {
          'x-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Fetch detailed user data for each best friend to get addresses
    if (data.users && data.users.length > 0) {
      const friendFids = data.users.map((user: { fid: number }) => user.fid);
      const client = getNeynarClient();
      const usersResponse = await client.fetchBulkUsers({ fids: friendFids });
      
      // Combine best friends data with detailed user data
      return data.users.map((bestFriend: { fid: number; username: string; mutual_affinity_score: number }) => {
        const detailedUser = usersResponse.users.find(u => u.fid === bestFriend.fid);
        return {
          fid: bestFriend.fid,
          username: bestFriend.username,
          display_name: detailedUser?.display_name || bestFriend.username,
          pfp_url: detailedUser?.pfp_url || '',
          mutual_affinity_score: bestFriend.mutual_affinity_score,
          custody_address: detailedUser?.custody_address || '',
          verified_addresses: detailedUser?.verified_addresses || { eth_addresses: [], sol_addresses: [] },
        };
      }).filter((friend: BestFriend) => 
        // Only include friends with ethereum addresses (needed for streaming)
        friend.custody_address || friend.verified_addresses.eth_addresses.length > 0
      );
    }

    return [];
  } catch (error) {
    console.error("Error getting best friends:", error);
    return [];
  }
}
