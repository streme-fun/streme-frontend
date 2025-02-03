"use client";

import { TokenGrid } from "./components/TokenGrid";
import { TokenTable } from "./components/TokenTable";
import { ViewSwitcher } from "./components/ViewSwitcher";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { TotalRewards } from "./components/TotalRewards";
import { useState } from "react";

// Calculate initial total and rate from TokenTable data
const initialTotal = 4234567.89; // About $4.2M
const ratePerSecond = 52.45; // About $4.5M per day

export default function Home() {
  const [view, setView] = useState<"grid" | "table">("grid");

  return (
    <>
      <Navbar />
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full">
          <TotalRewards
            initialTotal={initialTotal}
            ratePerSecond={ratePerSecond}
          />
          <div className="w-full max-w-[1200px]">
            <ViewSwitcher view={view} onChange={setView} />
            {view === "grid" ? <TokenGrid /> : <TokenTable />}
          </div>
        </main>
        <div className="row-start-3">
          <Footer />
        </div>
      </div>
    </>
  );
}
