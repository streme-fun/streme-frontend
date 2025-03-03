import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import { Providers } from "./providers";
import { FRAME_METADATA } from "../lib/frame";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Streme Fun",
  description: "Streme Fun",
  other: {
    "fc:frame": JSON.stringify(FRAME_METADATA),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-4`}
      >
        <ClientLayout>
          <Providers>{children}</Providers>
        </ClientLayout>
      </body>
    </html>
  );
}
