import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import { PostHogProvider } from "../components/providers/PostHogProvider";

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
    <html lang="en" data-theme="light">
      <head>
        {/* Performance hint for Farcaster Quick Auth server, per docs */}
        <link rel="preconnect" href="https://auth.farcaster.xyz" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize theme before the page renders
              (function() {
                const theme = localStorage.getItem('theme') || 
                            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
              })();

              // Initialize Eruda debugging console early if debug=true or in development
              (function() {
                const urlParams = new URLSearchParams(window.location.search);
                const isDebug = urlParams.get('debug') === 'true';
                const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                
                if (isDebug || isDev) {
                  const script = document.createElement('script');
                  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
                  script.onload = function() {
                    window.eruda.init();
                    console.log('🐛 Eruda debugging console initialized (early load)');
                  };
                  document.head.appendChild(script);
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-4`}
      >
        <PostHogProvider>
          <ClientLayout>{children}</ClientLayout>
        </PostHogProvider>
      </body>
    </html>
  );
}
