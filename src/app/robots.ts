import { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  (!process.env.VERCEL_ENV && baseUrl.includes("poligraph.fr") && !baseUrl.includes("staging"));

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: isProduction ? "/" : undefined,
        disallow: isProduction ? ["/admin/", "/api/admin/"] : ["/"],
      },
    ],
    sitemap: isProduction
      ? [
          `${baseUrl}/sitemap/0.xml`,
          `${baseUrl}/sitemap/1.xml`,
          `${baseUrl}/sitemap/2.xml`,
          `${baseUrl}/sitemap/3.xml`,
          `${baseUrl}/sitemap/4.xml`,
        ]
      : undefined,
  };
}
