/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
      },
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
    ],
    domains: [
      "utfs.io",
      "imagedelivery.net", // For the other image URLs in the API response
      "media.tenor.com",
      "api.streme.fun",
    ],
  },
  async headers() {
    const ContentSecurityPolicy = `
      connect-src 'self' https://auth.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://*.rpc.privy.systems https://explorer-api.walletconnect.com;
      frame-ancestors 'self' https://streme.fun https://www.streme.fun https://auth.privy.io;
    `;

    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
