import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const alchemyBaseUrl = process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL;
const fallbackRpcUrl = "https://base.llamarpc.com"; // Or another public RPC

export const publicClient = createPublicClient({
  chain: base,
  transport: http(alchemyBaseUrl || fallbackRpcUrl),
});
