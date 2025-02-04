export function Pagination() {
  return (
    <div className="flex justify-center items-center gap-2 py-8">
      <button className="btn btn-sm btn-ghost opacity-50" disabled>
        Previous
      </button>
      <button className="btn btn-sm btn-ghost bg-black/[.02] dark:bg-white/[.02]">
        1
      </button>
      <button className="btn btn-sm btn-ghost">2</button>
      <button className="btn btn-sm btn-ghost">3</button>
      <button className="btn btn-sm btn-ghost opacity-50">...</button>
      <button className="btn btn-sm btn-ghost">12</button>
      <button className="btn btn-sm btn-ghost">Next</button>
    </div>
  );
}
