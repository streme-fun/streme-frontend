import { TokenPageContent } from "./TokenPageContent";

interface TokenPageProps {
  params: { address: string };
}

export default function TokenPage({ params }: TokenPageProps) {
  return <TokenPageContent address={params.address} />;
}
