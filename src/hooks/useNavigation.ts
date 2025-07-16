"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useAppFrameLogic } from "./useAppFrameLogic";

export function useNavigation() {
  const router = useRouter();
  const { isMiniAppView } = useAppFrameLogic();

  const navigate = useCallback(
    (path: string) => {
      if (isMiniAppView) {
        // In mini-app context, we need to use SDK navigation if available
        // For now, we'll use router.push but this can be updated when SDK navigation is available
        router.push(path);
      } else {
        // Regular web navigation
        router.push(path);
      }
    },
    [isMiniAppView, router]
  );

  const openExternalUrl = useCallback(
    async (url: string) => {
      if (isMiniAppView && sdk) {
        try {
          // Use SDK's openUrl method if available
          await sdk.actions.openUrl(url);
        } catch {
          // Fallback to window.open if SDK method fails
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } else {
        // Regular web external link
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [isMiniAppView]
  );

  return {
    navigate,
    openExternalUrl,
    isMiniAppView,
  };
}