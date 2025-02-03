"use client";

type View = "grid" | "table";

export function ViewSwitcher({
  view,
  onChange,
}: {
  view: View;
  onChange: (view: View) => void;
}) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => onChange("grid")}
        className={`btn btn-sm ${
          view === "grid" ? "btn-primary" : "btn-ghost"
        }`}
      >
        Grid
      </button>
      <button
        onClick={() => onChange("table")}
        className={`btn btn-sm ${
          view === "table" ? "btn-primary" : "btn-ghost"
        }`}
      >
        Table
      </button>
    </div>
  );
}
