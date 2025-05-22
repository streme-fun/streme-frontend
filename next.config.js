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
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "arweave.net",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "media.tenor.com",
      },
      {
        protocol: "https",
        hostname: "api.streme.fun",
      },
      {
        protocol: "https",
        hostname: "images.colorino.site",
      },
      {
        protocol: "https",
        hostname: "warpcast.com",
      },
      {
        protocol: "https",
        hostname: "media.firefly.land",
      },
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://telegram.org;
              style-src 'self' 'unsafe-inline';
              connect-src 'self' 
                https://*.alchemy.com 
                https://*.base.org 
                https://*.llamarpc.com
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
                https://metamask-sdk.api.cx.metamask.io
                https://*.base.superfluid.dev;
              frame-src 'self'
                https://auth.privy.io
                https://verify.walletconnect.com
                https://verify.walletconnect.org
                https://challenges.cloudflare.com
                https://oauth.telegram.org
                https://*.geckoterminal.com
                https://www.geckoterminal.com
                https://app.uniswap.org;
              frame-ancestors 'self'
                https://streme.fun
                https://www.streme.fun
                https://auth.privy.io
                https://twelve-parrots-play.loca.lt
                https://farcaster.xyz
                https://warpcast.com
                https://wrpcd.net
                https://*.wrpcd.net
                blob:
                https://cdn.blockaid.io;
              img-src 'self' data: https: http:;
            `
              .replace(/\s{2,}/g, " ")
              .trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
