import App from "./app";

import { Metadata } from "next";
import { getFrameEmbedMetadata } from "../lib/utils";
import { APP_NAME, APP_DESCRIPTION, APP_OG_IMAGE_URL } from "../lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: APP_NAME,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      images: [APP_OG_IMAGE_URL],
    },
    other: {
      "fc:frame": JSON.stringify(getFrameEmbedMetadata()),
    },
  };
}

export default function RootPage() {
  return <App />;
}
