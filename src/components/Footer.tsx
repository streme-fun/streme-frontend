"use client";

import { useAppFrameLogic } from "../hooks/useAppFrameLogic";

export function Footer() {
  const { isMiniAppView } = useAppFrameLogic();

  if (isMiniAppView) {
    return null;
  }

  return (
    <footer className="mt-auto py-8 border-t border-black/[.1] dark:border-white/[.1]">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="text-sm opacity-60">
            © {new Date().getFullYear()} Streme
          </div>
          <a
            href="https://docs.streme.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm opacity-60 hover:opacity-100"
          >
            Docs
          </a>
        </div>
      </div>
    </footer>
  );
}
