import { TokenPageContent } from "./TokenPageContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Streme Team",
  description: "The Streme Team",
  metadataBase: new URL("https://streme.fun"),
  viewport: "width=device-width, initial-scale=1",
  other: {
    "fc:frame": "vNext",
    "fc:frame:image":
      "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/d47990cc-e752-4f47-fcf7-0fe278286400/original",
    "fc:frame:image:aspect_ratio": "1:1",
    "fc:frame:button:1": "Trade",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target":
      "https://streme.fun/token/0x340d15c2930805f47e946b934252b25406f365ac",
    "fc:frame:button:2": "Share",
    "fc:frame:button:2:action": "link",
    "fc:frame:button:2:target":
      "https://warpcast.com/~/compose?text=Check%20out%20$%3Csymbol%3E%20deployed%20by%20@%3Cdeployer%3E%20on%20Streme.fun!&embeds[]=https://streme.fun/token/0x340d15c2930805f47e946b934252b25406f365ac",
  },
  openGraph: {
    title: "The Streme Team",
    images:
      "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/d47990cc-e752-4f47-fcf7-0fe278286400/original",
  },
};

export default function TokenPage() {
  return <TokenPageContent />;
}
