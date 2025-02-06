import { TokenPageContent } from "./TokenPageContent";

export default async function TokenPage({
  params,
}: {
  params: { address: string };
}) {
  return <TokenPageContent address={await Promise.resolve(params.address)} />;
}
