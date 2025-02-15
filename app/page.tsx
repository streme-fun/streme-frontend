"use client";

import { TokenGrid } from "./components/TokenGrid";
// import { ViewSwitcher } from "./components/ViewSwitcher";
import { useState, useEffect } from "react";
import { Hero } from "./components/Hero";
import { TopStreamer } from "./components/TopStreamer";
import { Token, TokensResponse } from "./types/token";

export default function RootPage() {
  return <Home />;
}

function Home() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await fetch("/api/tokens");
        const data: TokensResponse = await response.json();
        setTokens(data.data);
      } catch (error) {
        console.error("Error fetching tokens:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, []);

  return (
    <>
      <div className="font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full">
          <Hero />
          <TopStreamer />
          <div className="w-full max-w-[1200px]">
            {loading ? (
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
