import { base } from "viem/chains";
import { createConfig } from "wagmi";
import { http } from "viem";

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
});
