"use client";

export function Footer() {
  return (
    <footer className="mt-auto py-8 border-t border-black/[.1] dark:border-white/[.1]">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="text-sm opacity-60">
            © {new Date().getFullYear()} Streme.Fun
          </div>
        </div>
      </div>
    </footer>
  );
}
