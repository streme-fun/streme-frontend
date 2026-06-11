"use client";

import dynamic from "next/dynamic";
import { useAppFrameLogic } from "../../hooks/useAppFrameLogic";
import type { SkateChallenge } from "../../components/skate/StremeSkateGame";

const StremeSkateGame = dynamic(
  () => import("../../components/skate/StremeSkateGame"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          background:
            "linear-gradient(180deg, #0c0626 0%, #221060 55%, #45179b 100%)",
        }}
      >
        <span className="loading loading-spinner loading-lg text-white" />
      </div>
    ),
  }
);

export default function SkatePageClient({
  challenge,
}: {
  challenge?: SkateChallenge | null;
}) {
  const { isMiniAppView } = useAppFrameLogic();

  // Full-bleed within ClientLayout's px-4 main. Mini-app reserves 5rem for the
  // bottom navbar (main's pb-20); browser reserves 4.5rem for the fixed top
  // navbar (h-18).
  return (
    <div
      className="-mx-4 relative overflow-hidden"
      style={
        isMiniAppView
          ? { height: "calc(100dvh - 5rem)" }
          : { height: "calc(100dvh - 4.5rem)", marginTop: "4.5rem" }
      }
    >
      <StremeSkateGame challenge={challenge} />
    </div>
  );
}
