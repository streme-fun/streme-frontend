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
        hostname: "supercast.mypinata.cloud",
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
        hostname: "*.arweave.net",
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
        hostname: "farcaster.xyz",
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
      {
        protocol: "https",
        hostname: "ipfs.decentralized-content.com",
      },
      {
        protocol: "https",
        hostname: "cdn.recaster.org",
      },
      {
        protocol: "https",
        hostname: "i.seadn.io",
      },
      {
        protocol: "https",
        hostname: "tba-mobile.mypinata.cloud",
      },
      {
        protocol: "https",
        hostname: "openseauserdata.com",
      },
      {
        protocol: "https",
        hostname: "wrpcd.net",
      },
      {
        protocol: "https",
        hostname: "*.wrpcd.net",
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
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://telegram.org https://player.vimeo.com;
              style-src 'self' 'unsafe-inline';
              connect-src 'self' 
                https://*.alchemy.com 
                https://*.base.org 
                https://*.llamarpc.com
                https://base.meowrpc.com
                https://1rpc.io
                https://base.blockpi.network
                https://base-rpc.publicnode.com
                https://auth.privy.io
                https://auth.farcaster.xyz
                https://farcaster.xyz
                https://client.farcaster.xyz
                https://warpcast.com
                https://client.warpcast.com
                https://wrpcd.net
                https://*.wrpcd.net
                https://privy.farcaster.xyz
                https://privy.warpcast.com
                wss://relay.walletconnect.com
                wss://relay.walletconnect.org
                wss://www.walletlink.org
                wss://ws.farcaster.xyz
                https://*.rpc.privy.systems
                https://explorer-api.walletconnect.com
                https://*.walletconnect.com
                https://*.walletconnect.org
                https://api.relay.link
                https://api.testnets.relay.link
                https://subgraph-endpoints.superfluid.dev
                https://rpc-endpoints.superfluid.dev
                https://*.base-mainnet.superfluid.dev
                https://metamask-sdk.api.cx.metamask.io
                https://*.base.superfluid.dev
                https://cloudflareinsights.com;
              frame-src 'self'
                https://auth.privy.io
                https://verify.walletconnect.com
                https://verify.walletconnect.org
                https://challenges.cloudflare.com
                https://oauth.telegram.org
                https://*.geckoterminal.com
                https://www.geckoterminal.com
                https://app.uniswap.org
                https://player.vimeo.com
                https://*.vimeo.com;
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
              img-src 'self' data: https: http: blob:;
            `
              .replace(/\s{2,}/g, " ")
              .trim(),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  webpack: (config) => {
    // Ignore React Native modules that MetaMask SDK tries to import in browser
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
    };
    return config;
  },
};

export default nextConfig;
