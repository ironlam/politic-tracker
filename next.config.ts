import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nosdeputes.fr",
        pathname: "/depute/photo/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/stats",
        destination: "/statistiques",
        permanent: true,
      },
      {
        source: "/api-docs",
        destination: "/docs/api",
        permanent: true,
      },
      {
        source: "/politique/:slug",
        destination: "/politiques/:slug",
        permanent: true,
      },
      {
        source: "/parti/:slug",
        destination: "/partis/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
