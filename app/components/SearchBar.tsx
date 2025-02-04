"use client";

export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder="Search for Token"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input input-ghost w-full h-10 bg-black/[.02] dark:bg-white/[.02] rounded-none text-sm"
    />
  );
}
