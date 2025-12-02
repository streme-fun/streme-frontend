import { SortOption } from "./TokenGrid";

interface SortButtonsProps {
  sortBy: SortOption;
  onSortChange: (option: SortOption) => void;
  isMiniView?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  // { value: "crowdfunds", label: "Crowdfunds" },
];

const SORT_OPTIONS_STANDARD: { value: SortOption; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "marketCap", label: "Market Cap" },
  // { value: "crowdfunds", label: "Crowdfunds" },
];

export function SortButtons({
  sortBy,
  onSortChange,
  isMiniView = false,
}: SortButtonsProps) {
  const options = isMiniView ? SORT_OPTIONS : SORT_OPTIONS_STANDARD;

  return (
    <div className="join w-full">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSortChange(option.value)}
          className={`btn btn-sm join-item ${isMiniView ? "flex-1" : ""} ${
            sortBy === option.value ? "btn-primary" : "btn-ghost"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
