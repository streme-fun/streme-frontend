import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PrivyProviderWrapper from "./components/auth/PrivyProviderWrapper";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import "./globals.css";

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
        <PrivyProviderWrapper>
          <Navbar />
          <main className="pt-20 px-4">{children}</main>
          <Footer />
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
