"use client";

import dynamic from "next/dynamic";
import { useAppFrameLogic } from "../../hooks/useAppFrameLogic";
import type { SurfChallenge } from "../../components/surf/StremeSurfGame";

// Three.js only runs in the browser
const StremeSurfGame = dynamic(
  () => import("../../components/surf/StremeSurfGame"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          background:
            "linear-gradient(180deg, #0a0f24 0%, #151238 55%, #2b1854 100%)",
        }}
      >
        <span className="loading loading-spinner loading-lg text-white" />
      </div>
    ),
  }
);

export default function SurfPageClient({
  challenge,
}: {
  challenge?: SurfChallenge | null;
}) {
  const { isMiniAppView } = useAppFrameLogic();

  // Full-bleed within ClientLayout's px-4 main. Mini-app reserves 5rem for
  // the bottom navbar (main's pb-20); browser reserves 4.5rem for the fixed
  // top navbar (h-18).
  return (
    <div
      className="-mx-4 relative overflow-hidden"
      style={
        isMiniAppView
          ? { height: "calc(100dvh - 5rem)" }
          : { height: "calc(100dvh - 4.5rem)", marginTop: "4.5rem" }
      }
    >
      <StremeSurfGame challenge={challenge} />
    </div>
  );
}
