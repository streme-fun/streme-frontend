import { TokenPageContent } from "./TokenPageContent";
import { Token } from "@/app/types/token";

async function getToken(address: Promise<string>): Promise<Token | null> {
  try {
    const resolvedAddress = await address;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/token/${resolvedAddress}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching token:", error);
    return null;
  }
}

interface PageProps {
  params: { address: Promise<string> };
}

export default async function TokenPage({ params }: PageProps) {
  const token = await getToken(params.address);

  if (!token) {
    return <div>Token not found</div>;
  }

  return <TokenPageContent initialToken={token} />;
}
