"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";

const PrivyProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        defaultChain: base,
        supportedChains: [base],
        appearance: {
          theme: "light", // or 'light'
          accentColor: "#676FFF", // Customize this to match your app's theme
          logo: "https://streme.fun/android-chrome-512x512.png", // URL to your logo
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
};

export default PrivyProviderWrapper;
