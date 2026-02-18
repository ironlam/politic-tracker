import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
  images: {
    remotePatterns: [
      // Assemblee nationale
      { protocol: "https", hostname: "www2.assemblee-nationale.fr" },
      { protocol: "https", hostname: "data.assemblee-nationale.fr" },
      // Senat
      { protocol: "https", hostname: "www.senat.fr" },
      { protocol: "https", hostname: "data.senat.fr" },
      // Wikimedia (Wikidata photos)
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      // HATVP
      { protocol: "https", hostname: "www.hatvp.fr" },
      // European Parliament
      { protocol: "https", hostname: "**.europarl.europa.eu" },
      // Gouvernement
      { protocol: "https", hostname: "www.gouvernement.fr" },
      // NosDéputés / NosSénateurs
      { protocol: "https", hostname: "www.nosdeputes.fr" },
      { protocol: "https", hostname: "www.nossenateurs.fr" },
      // data.gouv.fr (election photos)
      { protocol: "https", hostname: "www.data.gouv.fr" },
      { protocol: "https", hostname: "static.data.gouv.fr" },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/docs",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
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
