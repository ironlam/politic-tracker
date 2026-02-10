import { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://transparence-politique.fr";
const isProduction = baseUrl.includes("transparence-politique.fr") && !baseUrl.includes("staging");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: isProduction ? "/" : undefined,
        disallow: isProduction ? ["/admin/", "/api/admin/"] : ["/"],
      },
    ],
    sitemap: isProduction ? `${baseUrl}/sitemap.xml` : undefined,
  };
}
