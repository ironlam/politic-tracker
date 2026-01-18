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
};

export default nextConfig;
