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
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          showWalletUIs: true,
        },
        externalWallets: {
          coinbaseWallet: {
            connectionOptions: "smartWalletOnly",
          },
        },
        appearance: {
          theme: "light",
          accentColor: "#676FFF",
          logo: "https://streme.fun/android-chrome-512x512.png",
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only",
        },
        loginMethods: ["wallet"],
        mfa: {
          noPromptOnMfaRequired: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
};

export default PrivyProviderWrapper;
