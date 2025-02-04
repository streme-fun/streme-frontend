"use client";

import { TokenGrid } from "./components/TokenGrid";
import { TokenTable } from "./components/TokenTable";
import { ViewSwitcher } from "./components/ViewSwitcher";
import { useState } from "react";
import { ClientLayout } from "./components/ClientLayout";
import { Hero } from "./components/Hero";
import { TopStreamer } from "./components/TopStreamer";

export default function RootPage() {
  return (
    <ClientLayout>
      <Home />
    </ClientLayout>
  );
}

function Home() {
  const [view, setView] = useState<"grid" | "table">("grid");

  return (
    <>
      <div className="font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full">
          <Hero />
          <TopStreamer />
          <div className="w-full max-w-[1200px]">
            <ViewSwitcher view={view} onChange={setView} />
            {view === "grid" ? <TokenGrid /> : <TokenTable />}
          </div>
        </main>
      </div>
    </>
  );
}
