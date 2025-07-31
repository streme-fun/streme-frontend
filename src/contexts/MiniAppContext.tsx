"use client";

import { createContext, useContext } from "react";

// Mini-app context for sharing detection result across the app
export const MiniAppContext = createContext<boolean | null>(null);

export function useMiniAppContext() {
  const context = useContext(MiniAppContext);
  if (context === undefined) {
    throw new Error("useMiniAppContext must be used within MiniAppContext.Provider");
  }
  return context;
}