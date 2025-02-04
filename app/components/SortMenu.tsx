"use client";

import { useState } from "react";

type SortOption = {
  id: string;
  label: string;
  icon?: string;
};

const sortOptions: SortOption[] = [
  { id: "market_cap", label: "Market Cap" },
  { id: "featured", label: "Featured", icon: "🔥" },
  { id: "apy", label: "APY", icon: "📈" },
  { id: "stakers", label: "Stakers", icon: "👥" },
  { id: "last_trade", label: "Last Trade" },
  { id: "creation_time", label: "Creation Time" },
  { id: "last_reply", label: "Last Reply" },
];

export function SortMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string>("market_cap");

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="input input-ghost h-10 bg-black/[.02] dark:bg-white/[.02] rounded-none text-sm px-4 flex items-center gap-2 min-w-[160px]"
      >
        sort:{" "}
        {sortOptions.find((opt) => opt.id === selected)?.label.toLowerCase()}
        <span className="opacity-50 ml-auto">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[160px] bg-base-100 shadow-lg rounded-lg border border-black/[.1] dark:border-white/[.1] py-1 z-50">
          {sortOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setSelected(option.id);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left hover:bg-black/[.02] dark:hover:bg-white/[.02] flex items-center gap-2
                ${selected === option.id ? "text-primary" : ""}`}
            >
              {option.icon && <span>{option.icon}</span>}
              sort: {option.label.toLowerCase()}
              {selected === option.id && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
