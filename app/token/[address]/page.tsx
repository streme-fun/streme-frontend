import { TokenPageContent } from "./TokenPageContent";
import { Metadata } from "next";
import { getTokenData } from "@/app/lib/tokens"; // You'll need to implement this function

type Props = {
  params: {
    address: string;
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch token data - implement getTokenData to fetch token info from your data source
  const tokenData = await getTokenData(params.address);

  return {
    title: `${tokenData.name} (${tokenData.symbol}) - Streme Fun`,
    // You can also add other metadata like description if needed
    description: `Stake and earn rewards for ${tokenData.name} token on Streme Fun`,
  };
}

export default function TokenPage() {
  return <TokenPageContent />;
}
