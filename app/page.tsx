"use client";

import { TokenGrid } from "../components/TokenGrid";
// import { ViewSwitcher } from "./components/ViewSwitcher";
import { useState, useEffect } from "react";
import { Hero } from "../components/Hero";
import { TopStreamer } from "../components/TopStreamer";
import { Token, TokensResponse } from "./types/token";

export default function RootPage() {
  return <Home />;
}

function Home() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTokens = async (before?: number) => {
    try {
      const params = new URLSearchParams();
      if (before) params.append("before", before.toString());

      const response = await fetch(
        `/api/tokens${params.toString() ? `?${params}` : ""}`
      );
      const data: TokensResponse = await response.json();

      if (before) {
        setTokens((prev) => [...prev, ...data.data]);
      } else {
        setTokens(data.data);
      }

      // If there are more tokens, fetch them automatically
      if (data.hasMore && data.nextPage) {
        await fetchTokens(data.nextPage);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  return (
    <>
      <div className="font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full">
          <Hero />
          <TopStreamer />
          <div className="w-full max-w-[1200px]">
            {loading && tokens.length === 0 ? (
              <div className="text-center py-8">Loading tokens...</div>
            ) : (
              <TokenGrid tokens={tokens} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
