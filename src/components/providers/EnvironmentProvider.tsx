"use client";

import React, { createContext, useContext } from "react";

interface EnvironmentContextType {
  isMiniApp: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ 
  children, 
  isMiniApp 
}: { 
  children: React.ReactNode;
  isMiniApp: boolean;
}) {
  return (
    <EnvironmentContext.Provider value={{ isMiniApp }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
}