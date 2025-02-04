"use client";

import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import PrivyProviderWrapper from "./auth/PrivyProviderWrapper";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProviderWrapper>
      <Navbar />
      {children}
      <Footer />
    </PrivyProviderWrapper>
  );
}
