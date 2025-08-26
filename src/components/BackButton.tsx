"use client";

import { useRouter } from "next/navigation";

interface BackButtonProps {
  /** Only show in mini app view */
  isMiniAppView?: boolean;
  /** Destination path (defaults to "/") */
  destination?: string;
  /** Button label (defaults to "Back") */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Always show regardless of mini app view */
  alwaysShow?: boolean;
}

export default function BackButton({ 
  isMiniAppView = false,
  destination = "/",
  label = "Back",
  className = "",
  alwaysShow = false
}: BackButtonProps) {
  const router = useRouter();

  if (!alwaysShow && !isMiniAppView) return null;

  return (
    <div className={`px-4 pt-4 pb-2 ${className}`}>
      <button
        onClick={() => router.push(destination)}
        className="flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {label}
      </button>
    </div>
  );
}