"use client";

import { TokenGrid } from "./components/TokenGrid";
import { TokenTable } from "./components/TokenTable";
import { ViewSwitcher } from "./components/ViewSwitcher";
import { useState, useEffect } from "react";
import { Hero } from "./components/Hero";
import { TopStreamer } from "./components/TopStreamer";
import { Token, TokensResponse } from "./types/token";

export default function RootPage() {
  return <Home />;
}

function Home() {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  // Single data fetching implementation
  useEffect(() => {
    const pollTokens = async () => {
      try {
        const response = await fetch("/api/tokens");
        const data: TokensResponse = await response.json();
        setTokens(data.data);
      } catch (error) {
        console.error("Error polling tokens:", error);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    pollTokens();

    // Poll every 10 seconds
    const interval = setInterval(pollTokens, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full">
          <Hero />
          <TopStreamer />
          <div className="w-full max-w-[1200px]">
            <ViewSwitcher view={view} onChange={setView} />
            {loading ? (
              <div className="text-center py-8">Loading tokens...</div>
            ) : view === "grid" ? (
              <TokenGrid tokens={tokens} />
            ) : (
              <TokenTable tokens={tokens} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
