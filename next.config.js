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
    ],
  },
};

module.exports = nextConfig;
