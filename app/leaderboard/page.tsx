import { Leaderboard } from "../components/Leaderboard";
import { LeaderboardHeader } from "../components/LeaderboardHeader";
import { getTokens } from "@/app/lib/tokens";

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
