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
      connect-src 'self' 
        https://auth.privy.io 
        wss://relay.walletconnect.com 
        wss://relay.walletconnect.org 
        wss://www.walletlink.org 
        https://*.rpc.privy.systems 
        https://explorer-api.walletconnect.com
        https://api.relay.link
        https://api.testnets.relay.link
        https://subgraph-endpoints.superfluid.dev
        https://*.base-mainnet.superfluid.dev
        https://*.base.superfluid.dev;
      frame-ancestors 'self' 
        https://streme.fun 
        https://www.streme.fun 
        https://auth.privy.io;
      frame-src 'self' 
        https://auth.privy.io 
        https://verify.walletconnect.com 
        https://verify.walletconnect.org 
        https://challenges.cloudflare.com 
        https://oauth.telegram.org
        https://*.geckoterminal.com
        https://www.geckoterminal.com
        https://app.uniswap.org;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' 
        https://challenges.cloudflare.com 
        https://telegram.org;
      child-src 'self'
        https://auth.privy.io
        https://verify.walletconnect.com
        https://verify.walletconnect.org;
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
