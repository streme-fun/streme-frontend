import { Leaderboard } from "../../components/TokenLeaderboard";
import { LeaderboardHeader } from "../../components/LeaderboardHeader";
import { getTokens } from "@/src/lib/tokens";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const tokens = await getTokens();

  return (
    <div className="min-h-screen">
      <div className="border-b border-white/5"></div>
      <main className="container mx-auto px-4 py-8">
        <LeaderboardHeader />
        <Leaderboard tokens={tokens} />
      </main>
    </div>
  );
}
